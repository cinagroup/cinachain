import { describe, it, expect } from "vitest"
import { computePendingBadges, handleUsage } from "./index.js"
import billingWorker from "./index.js"
import { applyPricingOverrides, DEFAULT_PRICING } from "./lib/pricing.js"

// Ledger is wei-unit: 10 credit = 10e18 wei
const baseLedger = { onchainSnapshot: 10_000_000_000_000_000_000n, committedUsage: 0n, cumulativeSpend: 0n }

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
    const res = await handleUsage({ model: "demo", tokens: 1000n }, { ...baseLedger, onchainSnapshot: 1000n })
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
    ADMIN_KEY: "test-admin",
    CINA_BILLING_KV: {
      async get(k) { return store.has(k) ? store.get(k) : null },
      async put(k, v) { store.set(k, v) },
      async list({ prefix } = {}) {
        return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }
      },
    },
    store,
  }
}

async function callWorker(env, req) {
  return billingWorker.fetch(req, env)
}

describe("M2 admin endpoints", () => {
  it("GET /v1/admin/pending-badges lists ledgers with pending tier badges", async () => {
    const env = makeEnv()
    env.store.set("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0",
      cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    env.store.set("ledger:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0", cumulativeSpend: "0",
      pendingTierBadges: [], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/admin/pending-badges", {
      headers: { "X-Admin-Key": "test-admin" },
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pending).toHaveLength(1)
    expect(body.pending[0].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(body.pending[0].badges).toEqual(["bronze"])
  })

  it("rejects pending-badges without admin key", async () => {
    const res = await callWorker(makeEnv(), new Request("https://billing.test/v1/admin/pending-badges"))
    expect(res.status).toBe(401)
  })

  it("POST /v1/admin/badges/:address/:tier confirms a minted badge", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    env.store.set(`ledger:${ADDR}`, JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0",
      cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request(`https://billing.test/v1/admin/badges/${ADDR}/bronze/confirm`, {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: "0xabc" }),
    }))
    expect(res.status).toBe(200)
    const ledger = JSON.parse(env.store.get(`ledger:${ADDR}`))
    expect(ledger.pendingTierBadges).toEqual([])
    expect(ledger.mintedTierBadges).toEqual(["bronze"])
    expect(ledger.badgeTxHashes).toEqual({ bronze: "0xabc" })
  })

  it("rejects confirm with invalid tier", async () => {
    const res = await callWorker(makeEnv(), new Request(
      "https://billing.test/v1/admin/badges/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/free/confirm",
      {
        method: "POST",
        headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: "0xabc" }),
      }
    ))
    expect(res.status).toBe(400)
  })

  it("pending-badges includes custodial accounts (cust: prefix)", async () => {
    const env = makeEnv()
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", balanceWei: "0",
      committedUsage: "0", cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/admin/pending-badges", {
      headers: { "X-Admin-Key": "test-admin" },
    }))
    const body = await res.json()
    expect(body.pending).toHaveLength(1)
    expect(body.pending[0].custId).toBe("c1")
    expect(body.pending[0].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(body.pending[0].badges).toEqual(["bronze"])
  })

  it("confirm with custId updates the cust row, not a phantom ledger row", async () => {
    const env = makeEnv()
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", balanceWei: "0",
      committedUsage: "0", cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/admin/badges/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bronze/confirm", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: "0xabc", custId: "c1" }),
    }))
    expect(res.status).toBe(200)
    const cust = JSON.parse(env.store.get("cust:c1"))
    expect(cust.mintedTierBadges).toEqual(["bronze"])
    expect(cust.pendingTierBadges).toEqual([])
    // no phantom ledger row created
    expect(env.store.has("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false)
  })
})

describe("M2 custodial accounts", () => {
  it("POST /v1/custodial/accounts creates a DB-backed account", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^cust_[a-f0-9]{16}$/)
    const stored = JSON.parse(env.store.get(`cust:${body.id}`))
    expect(stored.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(stored.balanceWei).toBe("0")
  })

  it("admin credits a custodial account (pool funds already on-chain)", async () => {
    const env = makeEnv()
    env.store.set("cust:test1", JSON.stringify({ owner: "0xaaa", balanceWei: "0", committedUsage: "0", cumulativeSpend: "0" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: (100n * 10n ** 18n).toString() }),
    }))
    expect(res.status).toBe(200)
    const stored = JSON.parse(env.store.get("cust:test1"))
    expect(stored.balanceWei).toBe((100n * 10n ** 18n).toString())
  })

  it("rejects crediting a custodial account without admin key", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: "1" }),
    }))
    expect(res.status).toBe(401)
  })

  it("usage accepts a key bound to a custodial account", async () => {
    const env = makeEnv()
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaa", balanceWei: (10n * 10n ** 18n).toString(),
      committedUsage: "0", cumulativeSpend: "0",
    }))
    // keyRow stores the SHA-256 HASH of the raw api key (never the raw key)
    const data = new TextEncoder().encode("keyvalue")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))

    const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "keyvalue", model: "demo", tokens: "1000" }),
    }))
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
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaa", balanceWei: (10n * 10n ** 18n).toString(),
      committedUsage: (2n * 10n ** 18n).toString(),
      cumulativeSpend: (2n * 10n ** 18n).toString(),
      pendingTierBadges: [], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/c1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("c1")
    expect(body.usableCredit).toBe(8)
    expect(body.tier).toBe("free")
    expect(body.pendingBadges).toEqual([])
  })

  it("crediting a missing custodial account returns 404", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "missing", amountWei: "100" }),
    }))
    expect(res.status).toBe(404)
  })

  it("crediting with malformed amountWei returns 400", async () => {
    const env = makeEnv()
    env.store.set("cust:test1", JSON.stringify({ owner: "0xaaa", balanceWei: "0", committedUsage: "0", cumulativeSpend: "0" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: "abc" }),
    }))
    expect(res.status).toBe(400)
  })

  it("/v1/keys with unknown custId returns 404", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "012345678901234567890123", custId: "does-not-exist" }),
    }))
    expect(res.status).toBe(404)
  })

  it("admin debits a custodial account", async () => {
    const env = makeEnv()
    env.store.set("cust:test1", JSON.stringify({ owner: "0xaaa", balanceWei: (100n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/debit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: (40n * 10n ** 18n).toString() }),
    }))
    expect(res.status).toBe(200)
    const stored = JSON.parse(env.store.get("cust:test1"))
    expect(stored.balanceWei).toBe((60n * 10n ** 18n).toString())
  })

  it("debit rejects over-draw (insufficient balance)", async () => {
    const env = makeEnv()
    env.store.set("cust:test1", JSON.stringify({ owner: "0xaaa", balanceWei: (10n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/debit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: (11n * 10n ** 18n).toString() }),
    }))
    expect(res.status).toBe(400)
  })

  it("debit without admin key -> 401", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/debit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: "1" }),
    }))
    expect(res.status).toBe(401)
  })
})

// 追加到 index.test.js — 验证 usage 应用定价覆盖层
describe("M3 pricing override in handleUsage", () => {
  it("applies a merged pricing table", async () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "200" } })
    const ledger = { onchainSnapshot: 10_000_000_000_000_000_000n, committedUsage: 0n, cumulativeSpend: 0n }
    const res = await handleUsage({ model: "gpt-4o-mini", tokens: 1000n }, ledger, merged)
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
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "self", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }))
    // ledger with balance — usage will succeed
    env.store.set("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", JSON.stringify({
      onchainSnapshot: (10n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0",
    }))
    // stub RPC so refreshSnapshot doesn't fail (returns null -> falls back to ledger)
    const origFetch = global.fetch
    global.fetch = async () => { throw new Error("no rpc") }
    try {
      const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "histkey1", model: "demo", tokens: "1000" }),
      }))
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch // 恢复，避免污染其他用例
    }
    const histRaw = env.store.get("hist:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(histRaw).toBeTruthy()
    const hist = JSON.parse(histRaw)
    expect(hist).toHaveLength(1)
    expect(hist[0].model).toBe("demo")
    expect(hist[0].tokens).toBe("1000")
    expect(hist[0].chargedWei).toBe("2000000000000000000") // 2 credit
    expect(typeof hist[0].ts).toBe("number")

    const hres = await callWorker(env, new Request("https://billing.test/v1/history/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
    expect(hres.status).toBe(200)
    const hbody = await hres.json()
    expect(hbody.entries).toHaveLength(1)
    expect(hbody.entries[0].model).toBe("demo")
  })

  it("history caps at 100 entries (oldest dropped)", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    const existing = Array.from({ length: 100 }, (_, i) => ({ ts: i, model: "demo", tokens: "1", chargedWei: "1", tier: "free" }))
    env.store.set(`hist:${ADDR}`, JSON.stringify(existing))
    const hres = await callWorker(env, new Request(`https://billing.test/v1/history/${ADDR}`))
    expect(hres.status).toBe(200)
    const hbody = await hres.json()
    expect(hbody.entries).toHaveLength(100)
  })

  it("usage history for a custodial key uses hist:cust:<id>", async () => {
    const env = makeEnv()
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaa", balanceWei: (10n * 10n ** 18n).toString(),
      committedUsage: "0", cumulativeSpend: "0",
    }))
    const data = new TextEncoder().encode("histcust1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "histcust1", model: "demo", tokens: "1000" }),
    }))
    expect(res.status).toBe(200)
    expect(env.store.get("hist:cust:c1")).toBeTruthy()
  })
})
