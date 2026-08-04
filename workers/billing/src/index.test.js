import { describe, it, expect } from "vitest"
import { handleUsage } from "./index.js"

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
