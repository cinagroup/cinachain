import { describe, it, expect } from "vitest"
import {
  computeUsable,
  applyConsumption,
  getTier,
  pricingTable,
  estimateCost,
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
  it("tier by cumulative spend", () => {
    expect(getTier(0n)).toBe("free")
    expect(getTier(10_000n)).toBe("bronze")
    expect(getTier(100_000n)).toBe("silver")
    expect(getTier(1_000_000n)).toBe("gold")
    expect(getTier(10_000_000n)).toBe("diamond")
  })
  it("cost respects tier discount", () => {
    // 1000 tokens @ 2000 micro/token = 2_000_000 micro; bronze 95% -> 1_900_000
    const cost = estimateCost("demo", 1000n, "bronze")
    expect(cost).toBe(1_900_000n)
  })
})

describe("pricingTable", () => {
  it("demo model price present", () => {
    expect(pricingTable.demo.perTokenMicroCredit).toBeGreaterThan(0n)
  })
})
