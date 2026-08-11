import { secp256k1 } from "@noble/curves/secp256k1.js"
import { keccak_256 } from "@noble/hashes/sha3.js"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { describe, expect, it, vi } from "vitest"

import billingWorker, { computePendingBadges, handleUsage } from "./index.js"
import { applyPricingOverrides, DEFAULT_PRICING } from "./lib/pricing.js"
import { buildBindingMessage } from "./lib/sig-verify.js"

const TEST_ADMIN_KEY = `fixture-admin-key-${"0123456789abcdef".repeat(2)}`
const ADMIN_BINDING = ["ADMIN", "KEY"].join("_")

// Cloudflare Workers extends SubtleCrypto with timingSafeEqual. Node's Web
// Crypto test runtime does not, so provide a test-only equivalent.
if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value(left, right) {
      if (left.byteLength !== right.byteLength) {
        throw new TypeError("timingSafeEqual requires equal-length buffers")
      }
      const leftBytes = new Uint8Array(
        left.buffer ?? left,
        left.byteOffset ?? 0,
        left.byteLength
      )
      const rightBytes = new Uint8Array(
        right.buffer ?? right,
        right.byteOffset ?? 0,
        right.byteLength
      )
      let mismatch = 0
      for (let index = 0; index < leftBytes.byteLength; index += 1) {
        mismatch |= leftBytes[index] ^ rightBytes[index]
      }
      return mismatch === 0
    },
  })
}

// Fixed test keypair: signs the binding message to prove address ownership.
const SIGNER_PK =
  "2222222222222222222222222222222222222222222222222222222222222222"
const SIGNER_ADDR =
  "0x" +
  Buffer.from(
    keccak_256(
      secp256k1
        .getPublicKey(new Uint8Array(Buffer.from(SIGNER_PK, "hex")), false)
        .slice(1)
    )
  )
    .toString("hex")
    .slice(-40)

/** EIP-191 personal_sign over a binding message (noble-curves 1.x/2.x). */
function signBindingMessage(message) {
  const msgBytes = utf8ToBytes(message)
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  const hash = keccak_256(new Uint8Array([...prefix, ...msgBytes]))
  const pk = new Uint8Array(Buffer.from(SIGNER_PK, "hex"))
  const signed = secp256k1.sign(hash, pk, {
    prehash: false,
    format: "recovered",
  })
  const compact =
    signed instanceof Uint8Array
      ? signed.slice(1)
      : typeof signed.toBytes === "function"
      ? signed.toBytes("compact")
      : signed.toCompactRawBytes()
  const recovery = signed instanceof Uint8Array ? signed[0] : signed.recovery
  if (recovery !== 0 && recovery !== 1) {
    throw new Error("unsupported Ethereum recovery bit")
  }
  const rHex = Buffer.from(compact.slice(0, 32)).toString("hex")
  const sHex = Buffer.from(compact.slice(32)).toString("hex")
  return `0x${rHex}${sHex}${(27 + recovery).toString(16)}`
}

function bindingProof(
  env,
  {
    address = SIGNER_ADDR,
    nonce = "n1",
    issuedAt = new Date().toISOString(),
  } = {}
) {
  const message = buildBindingMessage(address, nonce, issuedAt)
  const signature = signBindingMessage(message)
  env.bindingMessage = message
  return { message, signature }
}

// Ledger is wei-unit: 10 credit = 10e18 wei
const baseLedger = {
  onchainSnapshot: 10_000_000_000_000_000_000n,
  committedUsage: 0n,
  cumulativeSpend: 0n,
}

describe("handleUsage", () => {
  it("charges and returns remaining", async () => {
    const res = await handleUsage({ model: "demo", tokens: 1000n }, baseLedger)
    expect(res.status).toBe(200)
    // 1000 tokens @ 2000 micro/token (free tier) = 2_000_000n micro = 2e18 wei
    // remaining = 1e19 wei (10 credit) - 2e18 wei = 8e18 wei
    expect(res.body.remainingWei).toBe("8000000000000000000")
  })
  it("no tier discount below bronze threshold (wei ledger)", async () => {
    // 5000 credit in wei cumulative spend -> still free tier (no discount)
    const ledger = { ...baseLedger, cumulativeSpend: 5_000n * 10n ** 18n }
    const res = await handleUsage({ model: "demo", tokens: 1000n }, ledger)
    expect(res.status).toBe(200)
    expect(res.body.tier).toBe("free")
    expect(res.body.chargedWei).toBe("2000000000000000000") // full price, no discount
  })
  it("429 when insufficient", async () => {
    const res = await handleUsage(
      { model: "demo", tokens: 1000n },
      { ...baseLedger, onchainSnapshot: 1000n }
    )
    expect(res.status).toBe(429)
  })
  it("400 for zero tokens", async () => {
    const res = await handleUsage({ model: "demo", tokens: 0n }, baseLedger)
    expect(res.status).toBe(400)
  })
})

describe("error paths", () => {
  it("unknown model -> 400", async () => {
    const res = await handleUsage({ model: "nope", tokens: 100n }, baseLedger)
    expect(res.status).toBe(400)
  })
  it("decimal tokens -> 400", async () => {
    const res = await handleUsage({ model: "demo", tokens: 1.5 }, baseLedger)
    expect(res.status).toBe(400)
  })
})

describe("billing worker", () => {
  it("exposes a scheduled handler for the indexer cron", () => {
    expect(typeof billingWorker.scheduled).toBe("function")
  })

  it("redirects insecure requests to HTTPS before reading secrets", async () => {
    const env = makeEnv()
    env.ADMIN_KEY.get = vi
      .fn()
      .mockRejectedValue(new Error("store unavailable"))

    const res = await callWorker(
      env,
      new Request("http://billing.test/v1/admin/pricing?source=smoke", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )

    expect(res.status).toBe(308)
    expect(res.headers.get("Location")).toBe(
      "https://billing.test/v1/admin/pricing?source=smoke"
    )
    expect(env.ADMIN_KEY.get).not.toHaveBeenCalled()
  })

  it("does not read admin secrets for public health checks", async () => {
    const env = makeEnv()
    env.ADMIN_KEY.get = vi
      .fn()
      .mockRejectedValue(new Error("store unavailable"))

    const res = await callWorker(
      env,
      new Request("https://billing.test/health")
    )

    expect(res.status).toBe(200)
    expect(env.ADMIN_KEY.get).not.toHaveBeenCalled()
  })

  it("returns 503 when the admin Secrets Store binding is missing", async () => {
    const env = makeEnv()
    env.ADMIN_KEY = undefined

    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("returns 503 when reading the admin secret fails", async () => {
    const env = makeEnv()
    env.ADMIN_KEY.get = vi
      .fn()
      .mockRejectedValue(new Error("store unavailable"))

    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )

    expect(res.status).toBe(503)
    expect(env.ADMIN_KEY.get).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["short", "fixture-short"],
    ["repeated", "x".repeat(32)],
    ["whitespace-containing", `${"a".repeat(32)} `],
  ])("returns 503 for a %s admin secret", async (_label, value) => {
    const env = makeEnv()
    env.ADMIN_KEY = secretBinding(value)

    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("hashes admin keys before timing-safe comparison", async () => {
    const env = makeEnv()
    env.ADMIN_KEY.get = vi.fn().mockResolvedValue(TEST_ADMIN_KEY)
    const compare = vi.spyOn(crypto.subtle, "timingSafeEqual")

    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": "incorrect" },
      })
    )

    expect(res.status).toBe(401)
    expect(env.ADMIN_KEY.get).toHaveBeenCalledTimes(1)
    expect(compare).toHaveBeenCalledTimes(1)
    const [expectedDigest, presentedDigest] = compare.mock.calls[0]
    expect(expectedDigest.byteLength).toBe(32)
    expect(presentedDigest.byteLength).toBe(32)
    compare.mockRestore()
  })
})

describe("M2 pending tier badges", () => {
  it("marks newly earned tiers as pending", () => {
    const spend = 5_000n * 10n ** 18n // below bronze
    expect(computePendingBadges(spend, [])).toEqual([])
    const crossed = 10_500n * 10n ** 18n // bronze crossed
    expect(computePendingBadges(crossed, [])).toEqual(["bronze"])
    // silver also crossed, bronze already minted
    const both = 105_000n * 10n ** 18n
    expect(computePendingBadges(both, ["bronze"])).toEqual(["silver"])
  })

  it("usage response exposes tier after crossing", async () => {
    const ledger = {
      onchainSnapshot: 10_000_000_000_000_000_000_000_000n, // 10M credit
      committedUsage: 0n,
      cumulativeSpend: 9_999n * 10n ** 18n,
    }
    const res = await handleUsage({ model: "demo", tokens: 1000n }, ledger)
    expect(res.status).toBe(200)
    expect(res.body.tier).toBe("bronze") // crossed 10k credit
    expect(res.body.pendingBadges).toEqual(["bronze"])
  })

  it("below threshold: free tier with no pending badges", async () => {
    const ledger = {
      onchainSnapshot: 10_000_000_000_000_000_000_000_000n,
      committedUsage: 0n,
      cumulativeSpend: 0n,
    }
    const res = await handleUsage({ model: "demo", tokens: 100n }, ledger)
    expect(res.status).toBe(200)
    expect(res.body.tier).toBe("free")
    expect(res.body.pendingBadges).toEqual([])
  })
})

function makeEnv() {
  const store = new Map()
  return {
    [ADMIN_BINDING]: secretBinding(TEST_ADMIN_KEY),
    CINA_BILLING_KV: {
      async get(k) {
        return store.has(k) ? store.get(k) : null
      },
      async put(k, v) {
        store.set(k, v)
      },
      async list({ prefix } = {}) {
        return {
          keys: [...store.keys()]
            .filter((k) => !prefix || k.startsWith(prefix))
            .map((name) => ({ name })),
        }
      },
    },
    store,
  }
}

function secretBinding(value) {
  return {
    async get() {
      return value
    },
  }
}

async function callWorker(env, req) {
  return billingWorker.fetch(req, env)
}

// Rate limiter allows 5 registrations/IP/10min — give every test its own IP.
let ipSeq = 0
function keysRequest(body) {
  return new Request("https://billing.test/v1/keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": `127.0.0.${++ipSeq}`,
    },
    body: JSON.stringify(body),
  })
}

describe("M2 admin endpoints", () => {
  it("GET /v1/admin/pending-badges lists ledgers with pending tier badges", async () => {
    const env = makeEnv()
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: "0",
        committedUsage: "0",
        cumulativeSpend: (20_000n * 10n ** 18n).toString(),
        pendingTierBadges: ["bronze"],
        mintedTierBadges: [],
      })
    )
    env.store.set(
      "ledger:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      JSON.stringify({
        onchainSnapshot: "0",
        committedUsage: "0",
        cumulativeSpend: "0",
        pendingTierBadges: [],
        mintedTierBadges: [],
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pending).toHaveLength(1)
    expect(body.pending[0].address).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
    expect(body.pending[0].badges).toEqual(["bronze"])
  })

  it("rejects pending-badges without admin key", async () => {
    const res = await callWorker(
      makeEnv(),
      new Request("https://billing.test/v1/admin/pending-badges")
    )
    expect(res.status).toBe(401)
  })

  it("POST /v1/admin/badges/:address/:tier confirms a minted badge", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    env.store.set(
      `ledger:${ADDR}`,
      JSON.stringify({
        onchainSnapshot: "0",
        committedUsage: "0",
        cumulativeSpend: (20_000n * 10n ** 18n).toString(),
        pendingTierBadges: ["bronze"],
        mintedTierBadges: [],
      })
    )
    const res = await callWorker(
      env,
      new Request(
        `https://billing.test/v1/admin/badges/${ADDR}/bronze/confirm`,
        {
          method: "POST",
          headers: {
            "X-Admin-Key": TEST_ADMIN_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txHash: "0xabc" }),
        }
      )
    )
    expect(res.status).toBe(200)
    const ledger = JSON.parse(env.store.get(`ledger:${ADDR}`))
    expect(ledger.pendingTierBadges).toEqual([])
    expect(ledger.mintedTierBadges).toEqual(["bronze"])
    expect(ledger.badgeTxHashes).toEqual({ bronze: "0xabc" })
  })

  it("rejects confirm with invalid tier", async () => {
    const res = await callWorker(
      makeEnv(),
      new Request(
        "https://billing.test/v1/admin/badges/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/free/confirm",
        {
          method: "POST",
          headers: {
            "X-Admin-Key": TEST_ADMIN_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txHash: "0xabc" }),
        }
      )
    )
    expect(res.status).toBe(400)
  })

  it("pending-badges includes custodial accounts (cust: prefix)", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        balanceWei: "0",
        committedUsage: "0",
        cumulativeSpend: (20_000n * 10n ** 18n).toString(),
        pendingTierBadges: ["bronze"],
        mintedTierBadges: [],
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pending-badges", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )
    const body = await res.json()
    expect(body.pending).toHaveLength(1)
    expect(body.pending[0].custId).toBe("c1")
    expect(body.pending[0].address).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
    expect(body.pending[0].badges).toEqual(["bronze"])
  })

  it("confirm with custId updates the cust row, not a phantom ledger row", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        balanceWei: "0",
        committedUsage: "0",
        cumulativeSpend: (20_000n * 10n ** 18n).toString(),
        pendingTierBadges: ["bronze"],
        mintedTierBadges: [],
      })
    )
    const res = await callWorker(
      env,
      new Request(
        "https://billing.test/v1/admin/badges/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bronze/confirm",
        {
          method: "POST",
          headers: {
            "X-Admin-Key": TEST_ADMIN_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txHash: "0xabc", custId: "c1" }),
        }
      )
    )
    expect(res.status).toBe(200)
    const cust = JSON.parse(env.store.get("cust:c1"))
    expect(cust.mintedTierBadges).toEqual(["bronze"])
    expect(cust.pendingTierBadges).toEqual([])
    // no phantom ledger row created
    expect(
      env.store.has("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ).toBe(false)
  })
})

describe("M2 custodial accounts", () => {
  it("POST /v1/custodial/accounts creates a DB-backed account", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^cust_[a-f0-9]{16}$/)
    const stored = JSON.parse(env.store.get(`cust:${body.id}`))
    expect(stored.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(stored.balanceWei).toBe("0")
  })

  it("admin credits a custodial account (pool funds already on-chain)", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:test1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: "0",
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/credit", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "test1",
          amountWei: (100n * 10n ** 18n).toString(),
        }),
      })
    )
    expect(res.status).toBe(200)
    const stored = JSON.parse(env.store.get("cust:test1"))
    expect(stored.balanceWei).toBe((100n * 10n ** 18n).toString())
  })

  it("rejects crediting a custodial account without admin key", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "test1", amountWei: "1" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("usage accepts a key bound to a custodial account", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    // keyRow stores the SHA-256 HASH of the raw api key (never the raw key)
    const data = new TextEncoder().encode("keyvalue")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))

    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "keyvalue",
          model: "demo",
          tokens: "1000",
        }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // 10 credit balance, 2 credit charge -> 8 credit remaining (8e18 wei)
    expect(body.remainingWei).toBe("8000000000000000000")
    const stored = JSON.parse(env.store.get("cust:c1"))
    expect(stored.committedUsage).toBe("2000000000000000000")
    // DB balance itself unchanged — usage is committed server-side
    expect(stored.balanceWei).toBe((10n * 10n ** 18n).toString())
  })

  it("GET /v1/custodial/:id returns account state", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (10n * 10n ** 18n).toString(),
        committedUsage: (2n * 10n ** 18n).toString(),
        cumulativeSpend: (2n * 10n ** 18n).toString(),
        pendingTierBadges: [],
        mintedTierBadges: [],
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/c1")
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("c1")
    expect(body.usableCredit).toBe(8)
    expect(body.tier).toBe("free")
    expect(body.pendingBadges).toEqual([])
  })

  it("crediting a missing custodial account returns 404", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/credit", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "missing", amountWei: "100" }),
      })
    )
    expect(res.status).toBe(404)
  })

  it("crediting with malformed amountWei returns 400", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:test1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: "0",
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/credit", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "test1", amountWei: "abc" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("/v1/keys with unknown custId returns 404", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "012345678901234567890123",
          custId: "does-not-exist",
        }),
      })
    )
    expect(res.status).toBe(404)
  })

  it("/v1/keys self-managed requires a signed binding message", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      keysRequest({ apiKey: "012345678901234567890123", address: SIGNER_ADDR })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/binding message/)
  })

  it("/v1/keys self-managed binds after signature verification", async () => {
    const env = makeEnv()
    const { message, signature } = bindingProof(env, { nonce: "nonce-abc" })
    const res = await callWorker(
      env,
      keysRequest({
        apiKey: "012345678901234567890123",
        address: SIGNER_ADDR,
        message,
        signature,
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.address).toBe(SIGNER_ADDR.toLowerCase())
    // Key row exists; nonce consumed (replay must be rejected)
    const keyRows = [...env.store.keys()].filter((k) => k.startsWith("key:"))
    expect(keyRows).toHaveLength(1)
    expect(
      [...env.store.keys()].filter((k) => k.startsWith("nonce:"))
    ).toHaveLength(1)
  })

  it("/v1/keys rejects a replayed nonce", async () => {
    const env = makeEnv()
    const { message, signature } = bindingProof(env, { nonce: "nonce-replay" })
    const body = {
      apiKey: "012345678901234567890123",
      address: SIGNER_ADDR,
      message,
      signature,
    }
    const first = await callWorker(env, keysRequest(body))
    expect(first.status).toBe(200)
    // Request objects are single-use — rebuild for the replay attempt.
    const replay = await callWorker(env, keysRequest(body))
    expect(replay.status).toBe(400)
    const replayBody = await replay.json()
    expect(replayBody.error).toMatch(/Nonce already used/)
  })

  it("/v1/keys rejects an expired binding message", async () => {
    const env = makeEnv()
    const { message, signature } = bindingProof(env, {
      nonce: "nonce-old",
      issuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    })
    const res = await callWorker(
      env,
      keysRequest({
        apiKey: "012345678901234567890123",
        address: SIGNER_ADDR,
        message,
        signature,
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/expired/)
  })

  it("/v1/keys rejects a signature from a different address", async () => {
    const env = makeEnv()
    // Message addresses a different wallet than the one that signed.
    const other = "0x" + "3".repeat(40)
    const { message, signature } = bindingProof(env, {
      address: other,
      nonce: "nonce-other",
    })
    const res = await callWorker(
      env,
      keysRequest({
        apiKey: "012345678901234567890123",
        address: other,
        message,
        signature,
      })
    )
    // Signature doesn't match the address in the body -> verification fails.
    expect(res.status).toBe(403)
  })

  it("admin debits a custodial account", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:test1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (100n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/debit", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "test1",
          amountWei: (40n * 10n ** 18n).toString(),
        }),
      })
    )
    expect(res.status).toBe(200)
    const stored = JSON.parse(env.store.get("cust:test1"))
    expect(stored.balanceWei).toBe((60n * 10n ** 18n).toString())
  })

  it("debit rejects over-draw (insufficient balance)", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:test1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/debit", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "test1",
          amountWei: (11n * 10n ** 18n).toString(),
        }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("debit without admin key -> 401", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/custodial/debit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "test1", amountWei: "1" }),
      })
    )
    expect(res.status).toBe(401)
  })
})

// 追加到 index.test.js — 验证 usage 应用定价覆盖层
describe("M3 pricing override in handleUsage", () => {
  it("applies a merged pricing table", async () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, {
      "gpt-4o-mini": { perTokenMicroCredit: "200" },
    })
    const ledger = {
      onchainSnapshot: 10_000_000_000_000_000_000n,
      committedUsage: 0n,
      cumulativeSpend: 0n,
    }
    const res = await handleUsage(
      { model: "gpt-4o-mini", tokens: 1000n },
      ledger,
      merged
    )
    expect(res.status).toBe(200)
    expect(res.body.chargedMicro).toBe("200000") // 200 micro × 1000
    expect(res.body.tier).toBe("free")
  })
})

describe("M3 consumption history", () => {
  it("usage writes a history entry; GET /v1/history/:address returns it", async () => {
    const env = makeEnv()
    // self key flow
    const data = new TextEncoder().encode("histkey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    // ledger with balance — usage will succeed
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    // stub RPC so refreshSnapshot doesn't fail (returns null -> falls back to ledger)
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "histkey1",
            model: "demo",
            tokens: "1000",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch // 恢复，避免污染其他用例
    }
    const histRaw = env.store.get(
      "hist:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
    expect(histRaw).toBeTruthy()
    const hist = JSON.parse(histRaw)
    expect(hist).toHaveLength(1)
    expect(hist[0].model).toBe("demo")
    expect(hist[0].tokens).toBe("1000")
    expect(hist[0].chargedWei).toBe("2000000000000000000") // 2 credit
    expect(typeof hist[0].ts).toBe("number")

    const hres = await callWorker(
      env,
      new Request(
        "https://billing.test/v1/history/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      )
    )
    expect(hres.status).toBe(200)
    const hbody = await hres.json()
    expect(hbody.entries).toHaveLength(1)
    expect(hbody.entries[0].model).toBe("demo")
  })

  it("history write-back caps at 100 entries (oldest dropped)", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    // seed a full history, then a usage write must drop the oldest (ts: 0)
    const existing = Array.from({ length: 100 }, (_, i) => ({
      ts: i,
      model: "demo",
      tokens: "1",
      chargedWei: "1",
      tier: "free",
    }))
    env.store.set(`hist:${ADDR}`, JSON.stringify(existing))
    const data = new TextEncoder().encode("histkey2")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({ kind: "self", address: ADDR })
    )
    env.store.set(
      `ledger:${ADDR}`,
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    const before = Date.now()
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "histkey2",
            model: "demo",
            tokens: "1000",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch // 恢复，避免污染其他用例
    }
    const hist = JSON.parse(env.store.get(`hist:${ADDR}`))
    expect(hist).toHaveLength(100) // still capped after the write
    expect(hist[0].ts).toBe(1) // oldest (ts: 0) dropped
    const newest = hist[99]
    expect(newest.ts).toBeGreaterThanOrEqual(before) // new entry with current ts
    expect(newest.chargedWei).toBe("2000000000000000000")
  })

  it("usage history for a custodial key uses hist:cust:<id>", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const data = new TextEncoder().encode("histcust1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "histcust1",
          model: "demo",
          tokens: "1000",
        }),
      })
    )
    expect(res.status).toBe(200)
    expect(env.store.get("hist:cust:c1")).toBeTruthy()
  })
})

describe("M3 ingress submit", () => {
  // checkRegRateLimit is shared per-IP (5 per 10-min window) across
  // /v1/custodial/accounts, /v1/keys and /v1/ingress, and the limiter is
  // module state shared by every test in this file — so each test below
  // simulates a distinct client IP to keep its own budget.
  it("valid submit returns pending record id", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("0123456789abcdef".repeat(4))
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.1",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_abcdefghijklmnopqrstuvwxyz",
          model: "demo",
          declaredMicro: "2000000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^ing_/)
    expect(body.status).toBe("pending")
    const rec = JSON.parse(env.store.get(`ing:${body.id}`))
    expect(rec.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(rec.confirmedMicro).toBe("0")
    // plaintext key never stored — only encrypted + hash
    expect(JSON.stringify(rec)).not.toContain(
      "ingress_test_abcdefghijklmnopqrstuvwxyz"
    )
    expect(rec.encrypted.cipher).toBeTruthy()
  })

  it("duplicate key submission -> 409", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("0123456789abcdef".repeat(4))
    const body1 = {
      apiKey: "ingress_test_dup_abcdefghijklmnopqrstuv",
      model: "demo",
      declaredMicro: "1000",
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }
    const r1 = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.2",
        },
        body: JSON.stringify(body1),
      })
    )
    expect(r1.status).toBe(200)
    const r2 = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.2",
        },
        body: JSON.stringify(body1),
      })
    )
    expect(r2.status).toBe(409)
  })

  it("invalid declaredMicro -> 400; missing enc binding -> 503", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("0123456789abcdef".repeat(4))
    const bad = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.3",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_bad_abcdefghijklmnopqr",
          model: "demo",
          declaredMicro: "0",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(bad.status).toBe(400)
    const noKey = makeEnv()
    noKey.INGRESS_ENC_KEY = undefined
    const unavailable = await callWorker(
      noKey,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.3",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_nk_abcdefghijklmnopqr",
          model: "demo",
          declaredMicro: "1000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("returns 503 when reading the ingress encryption secret fails", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = {
      get: vi.fn().mockRejectedValue(new Error("store unavailable")),
    }
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.31",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_fail_abcdefghijklmnop",
          model: "demo",
          declaredMicro: "1000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
    expect(env.INGRESS_ENC_KEY.get).toHaveBeenCalledTimes(1)
    expect([...env.store.keys()].some((key) => key.startsWith("ing:"))).toBe(
      false
    )
  })

  it("refuses an empty ingress encryption secret -> 503", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("")
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.32",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_empty_abcdefghijklmnop",
          model: "demo",
          declaredMicro: "1000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("refuses a repeated-character INGRESS_ENC_KEY -> 503", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("a".repeat(64))
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.4",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_ph_abcdefghijklmnopqr",
          model: "demo",
          declaredMicro: "1000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("refuses a non-hex INGRESS_ENC_KEY -> 503", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = secretBinding("z".repeat(64))
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.40",
        },
        body: JSON.stringify({
          apiKey: "ingress_test_hex_abcdefghijklmnopqr",
          model: "demo",
          declaredMicro: "1000",
          owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }),
      })
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: "Service configuration unavailable",
    })
  })

  it("GET /v1/ingress?owner= lists only that owner's records", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ingA",
      JSON.stringify({
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        model: "demo",
        declaredMicro: "1000",
        confirmedMicro: "0",
        status: "pending",
        createdAt: 1,
      })
    )
    env.store.set(
      "ing:ingB",
      JSON.stringify({
        owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        model: "demo",
        declaredMicro: "2000",
        confirmedMicro: "0",
        status: "pending",
        createdAt: 2,
      })
    )
    const res = await callWorker(
      env,
      new Request(
        "https://billing.test/v1/ingress?owner=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      )
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toHaveLength(1)
    expect(body.records[0].id).toBe("ingA")
    expect(body.records[0].status).toBe("pending")
  })

  it("GET /v1/ingress with invalid owner -> 400", async () => {
    const env = makeEnv()
    // distinct client IP keeps its own rate-limit budget (module-level limiter)
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress?owner=0x123", {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      })
    )
    expect(res.status).toBe(400)
  })
})

describe("M3 ingress consumption", () => {
  it("usage with ingressId accumulates confirmedMicro; flips to minting at declared", async () => {
    const env = makeEnv()
    // self key flow with ingressId
    const data = new TextEncoder().encode("ingresskey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "0",
        status: "pending",
        keyHash: hash,
        createdAt: 1,
        encrypted: { iv: "00", cipher: "00" },
      })
    )
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "ingresskey1",
            model: "demo",
            tokens: "1000",
            ingressId: "ing1",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
    const rec = JSON.parse(env.store.get("ing:ing1"))
    // 1000 tokens demo @2000 micro = 2e6 micro = declared 2e6 -> minting
    expect(rec.confirmedMicro).toBe("2000000")
    expect(rec.status).toBe("minting")
  })

  it("usage with unknown ingressId is ignored (no crash)", async () => {
    const env = makeEnv()
    const data = new TextEncoder().encode("ingresskey2")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "ingresskey2",
            model: "demo",
            tokens: "100",
            ingressId: "nope",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
  })

  it("POST /v1/ingress/:id/confirm marks minted", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "2000000",
        status: "minting",
        keyHash: "0xabc",
        createdAt: 1,
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash: "0xdef" }),
      })
    )
    expect(res.status).toBe(200)
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.status).toBe("minted")
    expect(rec.txHash).toBe("0xdef")
  })

  it("confirm rejects bad transitions (pending -> minted)", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "0",
        status: "pending",
        keyHash: "0xabc",
        createdAt: 1,
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash: "0xdef" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("confirm is idempotent for the same txHash (retry-safe, no double-mint)", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "2000000",
        status: "minted",
        txHash: "0xdef",
        keyHash: "0xabc",
        createdAt: 1,
      })
    )
    // Simulated retry after a timeout — must succeed without re-minting.
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash: "0xdef" }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyMinted).toBe(true)
    // Record unchanged (no second mint).
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.status).toBe("minted")
    expect(rec.txHash).toBe("0xdef")
  })

  it("confirm rejects a conflicting txHash on an already-minted record", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "2000000",
        status: "minted",
        txHash: "0xdef",
        keyHash: "0xabc",
        createdAt: 1,
      })
    )
    // A second mint attempt with a different txHash must be refused.
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash: "0xDEADBEEF" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("confirm without admin key -> 401", async () => {
    const env = makeEnv()
    env.store.set("ing:ing1", JSON.stringify({ status: "minting" }))
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: "0xdef" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("GET /v1/admin/ingress?status=minting lists minting records", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "2000000",
        status: "minting",
        createdAt: 1,
      })
    )
    env.store.set(
      "ing:ing2",
      JSON.stringify({
        owner: "0xbbb",
        model: "demo",
        declaredMicro: "1000",
        confirmedMicro: "0",
        status: "pending",
        createdAt: 2,
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/ingress?status=minting", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toHaveLength(1)
    expect(body.records[0].id).toBe("ing1")
    expect(body.records[0].confirmedMicro).toBe("2000000")
  })

  it("corrupted ingress row does not block charging (ledger still committed)", async () => {
    const env = makeEnv()
    const data = new TextEncoder().encode("ingresskey3")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    env.store.set("ing:ing_bad", "{ not json")
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "ingresskey3",
            model: "demo",
            tokens: "100",
            ingressId: "ing_bad",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
    // charge still committed: 100 tokens demo @2000 micro = 2e5 micro = 2e17 wei
    const ledger = JSON.parse(
      env.store.get("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    )
    expect(ledger.committedUsage).toBe("200000000000000000")
  })

  it("confirm with a corrupted record -> 400 (not 500)", async () => {
    const env = makeEnv()
    env.store.set("ing:ing1", "{ not json")
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/ingress/ing1/confirm", {
        method: "POST",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash: "0xdef" }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("usage with ingressId on a custodial key also attributes", async () => {
    const env = makeEnv()
    env.store.set(
      "cust:c1",
      JSON.stringify({
        owner: "0xaaa",
        balanceWei: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const data = new TextEncoder().encode("custingresskey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "1000000",
        confirmedMicro: "0",
        status: "pending",
        keyHash: hash,
        createdAt: 1,
      })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: "custingresskey1",
          model: "demo",
          tokens: "1000",
          ingressId: "ing1",
        }),
      })
    )
    expect(res.status).toBe(200)
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.confirmedMicro).toBe("2000000") // 1000 tokens demo @2000 micro
    expect(rec.status).toBe("minting") // declared 1e6 -> crossed
  })

  it("usage after flip to minting is not attributed again (status guard)", async () => {
    const env = makeEnv()
    const data = new TextEncoder().encode("ingresskey4")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "2000000",
        status: "minting",
        keyHash: hash,
        createdAt: 1,
      })
    )
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "ingresskey4",
            model: "demo",
            tokens: "100",
            ingressId: "ing1",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.confirmedMicro).toBe("2000000") // unchanged
    expect(rec.status).toBe("minting") // unchanged
  })

  it("usage with a mismatched key does NOT attribute to the ingress record", async () => {
    const env = makeEnv()
    env.store.set(
      "ing:ing1",
      JSON.stringify({
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        model: "demo",
        declaredMicro: "2000000",
        confirmedMicro: "0",
        status: "pending",
        keyHash: "0xcorrectkeyhash",
        createdAt: 1,
      })
    )
    // self key flow — this key's hash differs from the record's keyHash
    const data = new TextEncoder().encode("ingresskey_mismatch_0123456789ab")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "ingresskey_mismatch_0123456789ab",
            model: "demo",
            tokens: "1000",
            ingressId: "ing1",
          }),
        })
      )
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.confirmedMicro).toBe("0") // not attributed
    expect(rec.status).toBe("pending")
  })
})

describe("M3 pricing admin", () => {
  it("GET /v1/admin/pricing returns defaults + overrides", async () => {
    const env = makeEnv()
    env.store.set(
      "pricing",
      JSON.stringify({ "gpt-4o-mini": { perTokenMicroCredit: "150" } })
    )
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pricing", {
        headers: { "X-Admin-Key": TEST_ADMIN_KEY },
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overrides["gpt-4o-mini"].perTokenMicroCredit).toBe("150")
    expect(body.default.demo.perTokenMicroCredit).toBe(2000)
  })

  it("PUT /v1/admin/pricing validates and persists overrides", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pricing", {
        method: "PUT",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrides: { demo: { perTokenMicroCredit: "2500" } },
        }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // JSON round-trips cannot carry BigInt, so the merged table is serialized
    // with micro prices as JSON numbers (mirrors GET's default table).
    expect(body.merged.demo.perTokenMicroCredit).toBe(2500)
    expect(JSON.parse(env.store.get("pricing")).demo.perTokenMicroCredit).toBe(
      "2500"
    )
  })

  it("PUT rejects invalid overrides with 400", async () => {
    const env = makeEnv()
    const res = await callWorker(
      env,
      new Request("https://billing.test/v1/admin/pricing", {
        method: "PUT",
        headers: {
          "X-Admin-Key": TEST_ADMIN_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrides: { nope: { perTokenMicroCredit: "1" } },
        }),
      })
    )
    expect(res.status).toBe(400)
  })

  it("usage applies runtime pricing overrides from KV", async () => {
    const env = makeEnv()
    env.store.set(
      "pricing",
      JSON.stringify({ "gpt-4o-mini": { perTokenMicroCredit: "200" } })
    )
    const data = new TextEncoder().encode("pricingkey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "pricingkey1",
            model: "gpt-4o-mini",
            tokens: "1000",
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.chargedMicro).toBe("200000") // 200 micro × 1000, free tier
    } finally {
      global.fetch = origFetch
    }
  })

  it("usage falls back to DEFAULT pricing when the pricing blob is corrupted", async () => {
    const env = makeEnv()
    env.store.set("pricing", "{ not json")
    const data = new TextEncoder().encode("pricingkey2")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    env.store.set(
      `key:${hash}`,
      JSON.stringify({
        kind: "self",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      })
    )
    env.store.set(
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      JSON.stringify({
        onchainSnapshot: (10n * 10n ** 18n).toString(),
        committedUsage: "0",
        cumulativeSpend: "0",
      })
    )
    const origFetch = global.fetch
    global.fetch = async () => {
      throw new Error("no rpc")
    }
    try {
      const res = await callWorker(
        env,
        new Request("https://billing.test/v1/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: "pricingkey2",
            model: "demo",
            tokens: "1000",
          }),
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.chargedMicro).toBe("2000000") // default demo 2000 micro × 1000
    } finally {
      global.fetch = origFetch
    }
  })
})
