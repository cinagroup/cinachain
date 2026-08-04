// workers/billing/src/lib/pricing.test.js
import { describe, it, expect } from "vitest"
import { DEFAULT_PRICING, applyPricingOverrides, estimateCostWithPricing } from "./pricing.js"

describe("DEFAULT_PRICING", () => {
  it("keeps demo pricing and adds models", () => {
    expect(DEFAULT_PRICING.demo.perTokenMicroCredit).toBe(2000n)
    expect(DEFAULT_PRICING["gpt-4o-mini"].perTokenMicroCredit).toBe(100n)
    expect(DEFAULT_PRICING["deepseek-v3"].perTokenMicroCredit).toBe(500n)
    expect(DEFAULT_PRICING["hunyuan"].perTokenMicroCredit).toBe(800n)
  })
})

describe("applyPricingOverrides", () => {
  it("merges overrides on top of defaults (partial)", () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "150" } })
    expect(merged["gpt-4o-mini"].perTokenMicroCredit).toBe(150n)
    expect(merged.demo.perTokenMicroCredit).toBe(2000n) // untouched
    expect(merged["deepseek-v3"].perTokenMicroCredit).toBe(500n) // untouched
  })
  it("rejects unknown models in overrides", () => {
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { nope: { perTokenMicroCredit: "1" } })).toThrow(/unknown model/)
  })
  it("rejects non-positive or non-integer prices", () => {
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { demo: { perTokenMicroCredit: "0" } })).toThrow(/positive/)
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { demo: { perTokenMicroCredit: "1.5" } })).toThrow(/integer/)
  })
  it("accepts null overrides (no-op)", () => {
    expect(applyPricingOverrides(DEFAULT_PRICING, null)).toEqual(DEFAULT_PRICING)
  })
  it("accepts a null row as no-op", () => {
    expect(applyPricingOverrides(DEFAULT_PRICING, { demo: null })).toEqual(DEFAULT_PRICING)
  })
  it("accepts number-typed values", () => {
    expect(applyPricingOverrides(DEFAULT_PRICING, { demo: { perTokenMicroCredit: 3000 } }).demo.perTokenMicroCredit).toBe(3000n)
  })
})

describe("estimateCostWithPricing", () => {
  it("computes cost with a merged table", () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "200" } })
    const cost = estimateCostWithPricing(merged, "gpt-4o-mini", 1000n, "free")
    expect(cost).toBe(200_000n) // 200 micro × 1000
  })
  it("applies the tier discount (bronze 5% off, matching billing-core estimateCost)", () => {
    const cost = estimateCostWithPricing(DEFAULT_PRICING, "gpt-4o-mini", 1000n, "bronze")
    expect(cost).toBe(95_000n) // 100 micro × 1000 = 100_000 base, × 9500/10000
  })
  it("throws for unknown model", () => {
    expect(() => estimateCostWithPricing(DEFAULT_PRICING, "nope", 1n, "free")).toThrow(/unknown model/)
  })
  it("throws for unknown tier", () => {
    expect(() => estimateCostWithPricing(DEFAULT_PRICING, "demo", 1n, "bogus")).toThrow(/unknown tier/)
  })
})
