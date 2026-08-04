import { describe, it, expect } from "vitest"
import {
  computeUsable,
  applyConsumption,
  getTier,
  pricingTable,
  estimateCost,
  costToWei,
  microToCredit,
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
