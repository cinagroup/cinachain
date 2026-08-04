import { describe, it, expect } from "vitest"
import { computePendingBadges, handleUsage } from "./index.js"
import billingWorker from "./index.js"

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
})
