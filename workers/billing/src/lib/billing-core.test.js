import { describe, it, expect } from "vitest"
import {
  computeUsable,
  applyConsumption,
  getTier,
  pricingTable,
  estimateCost,
  costToWei,
  microToCredit,
  tiersEarned,
  tierProgress,
  tierBadgeId,
  TIER_BADGE_IDS,
} from "./billing-core.js"

describe("computeUsable", () => {
  it("usable = onchain - committed", () => {
    expect(computeUsable(1000n, 300n)).toBe(700n)
  })
  it("never negative", () => {
    expect(computeUsable(100n, 300n)).toBe(0n)
  })
  it("transfer-out drops usable immediately", () => {
    expect(computeUsable(100n, 0n)).toBe(100n)
  })
})

describe("applyConsumption", () => {
  it("deducts and accumulates spend", () => {
    const res = applyConsumption({ committedUsage: 100n, cumulativeSpend: 0n }, 50n)
    expect(res.committedUsage).toBe(150n)
    expect(res.cumulativeSpend).toBe(50n)
  })
})

describe("getTier / pricing", () => {
  it("tier by cumulative spend (wei units)", () => {
    expect(getTier(0n)).toBe("free")
    expect(getTier(9_999n * 10n ** 18n)).toBe("free")
    expect(getTier(10_000n * 10n ** 18n)).toBe("bronze")
    expect(getTier(100_000n * 10n ** 18n)).toBe("silver")
    expect(getTier(1_000_000n * 10n ** 18n)).toBe("gold")
    expect(getTier(10_000_000n * 10n ** 18n)).toBe("diamond")
  })
  it("cost respects tier discount", () => {
    // 1000 tokens @ 2000 micro/token = 2_000_000 micro; bronze 95% -> 1_900_000
    // (bronze discount applies once cumulative spend reaches 1 万 credit = 1e22 wei)
    const cost = estimateCost("demo", 1000n, "bronze")
    expect(cost).toBe(1_900_000n)
  })
})

describe("pricingTable", () => {
  it("demo model price present", () => {
    expect(pricingTable.demo.perTokenMicroCredit).toBeGreaterThan(0n)
  })
})

describe("unit bridge", () => {
  it("costToWei converts micro to wei", () => {
    // 2000 micro × 1e12 wei/micro = 2e15 wei
    expect(costToWei(2000n)).toBe(2_000_000_000_000_000n)
  })
  it("microToCredit converts", () => {
    expect(microToCredit(2_000_000n)).toBe(2n)
  })
})

describe("edge cases", () => {
  it("applyConsumption defaults missing fields", () => {
    const res = applyConsumption({}, 50n)
    expect(res.committedUsage).toBe(50n)
    expect(res.cumulativeSpend).toBe(50n)
  })
  it("estimateCost throws on unknown tier", () => {
    expect(() => estimateCost("demo", 100n, "platinum")).toThrow("unknown tier")
  })
  it("estimateCost throws on unknown model", () => {
    expect(() => estimateCost("nope", 100n)).toThrow("unknown model")
  })
  it("getTier rejects negatives", () => {
    expect(() => getTier(-1n)).toThrow()
  })
  it("estimateCost defaults to free tier", () => {
    expect(estimateCost("demo", 1000n)).toBe(2_000_000n)
  })
})

describe("M2 tier engine", () => {
  it("whale threshold at 100M credit", () => {
    const whale = 100_000_000n * 10n ** 18n
    expect(getTier(whale - 1n)).toBe("diamond")
    expect(getTier(whale)).toBe("whale")
  })
  it("tiersEarned lists every threshold crossed, ascending", () => {
    const spend = 120_000n * 10n ** 18n // 12 万 credit: bronze + silver
    expect(tiersEarned(spend)).toEqual(["bronze", "silver"])
    expect(tiersEarned(0n)).toEqual([])
  })
  it("tierProgress reports next tier and bps progress", () => {
    // bronze floor 10k, silver next 100k; 55k -> (55-10)/(100-10) = 50%
    const spend = 55_000n * 10n ** 18n
    const p = tierProgress(spend)
    expect(p.tier).toBe("bronze")
    expect(p.nextTier).toBe("silver")
    expect(p.progressBps).toBe(5000)
    expect(p.nextMin).toBe((100_000n * 10n ** 18n).toString())
  })
  it("tierProgress caps at whale (no next tier)", () => {
    const p = tierProgress(1_000_000_000n * 10n ** 18n)
    expect(p.tier).toBe("whale")
    expect(p.nextTier).toBeNull()
    expect(p.progressBps).toBe(10000)
  })
  it("badge id map covers bronze..whale", () => {
    expect(TIER_BADGE_IDS).toEqual({ bronze: 100n, silver: 101n, gold: 102n, diamond: 103n, whale: 104n })
  })
  it("whale keeps full pricing (custom contract outside scope)", () => {
    const tier = getTier(100_000_000n * 10n ** 18n)
    const cost = estimateCost("demo", 1000n, tier)
    expect(cost).toBe(2_000_000n) // 2000 micro × 1000 tokens, no discount
  })
  it("tierProgress floor edge: exactly at next threshold is 0 bps", () => {
    const p = tierProgress(100_000n * 10n ** 18n) // exactly silver floor
    expect(p.tier).toBe("silver")
    expect(p.progressBps).toBe(0)
    expect(p.nextTier).toBe("gold")
  })
  it("tierBadgeId returns null for free and unknown tiers", () => {
    expect(tierBadgeId("free")).toBeNull()
    expect(tierBadgeId("bogus")).toBeNull()
    expect(tierBadgeId("bronze")).toBe(100n)
  })
})
