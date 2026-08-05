import { describe, it, expect } from "vitest"
import { convertAmount, isValidType, MEGA_RATE_TEXT } from "../exchange"

describe("convertAmount — fixed rate 1 cina = 1000 mcina = 1M ucina", () => {
  it("ucina -> cina", () => {
    const r = convertAmount(1, 3, 1_000_000n)
    expect(r.ok).toBe(true)
    expect(r.toAmount).toBe(1n)
    expect(r.dust).toBe(0n)
  })

  it("cina -> mcina", () => {
    const r = convertAmount(3, 2, 1n)
    expect(r.ok).toBe(true)
    expect(r.toAmount).toBe(1000n)
  })

  it("cina -> ucina", () => {
    const r = convertAmount(3, 1, 1n)
    expect(r.ok).toBe(true)
    expect(r.toAmount).toBe(1_000_000n)
  })

  it("mcina -> ucina round trip", () => {
    expect(convertAmount(2, 1, 1000n).toAmount).toBe(1_000_000n)
    expect(convertAmount(1, 2, 1_000_000n).toAmount).toBe(1000n)
  })

  it("mcina -> cina", () => {
    const r = convertAmount(2, 3, 1000n)
    expect(r.ok).toBe(true)
    expect(r.toAmount).toBe(1n)
  })

  it("dust is computed and source-side", () => {
    // 1500 ucina -> mcina = 1, dust 500 units
    const r = convertAmount(1, 2, 1500n)
    expect(r.toAmount).toBe(1n)
    expect(r.dust).toBe(500n)
    // 1500 mcina -> cina = 1, dust 500,000 units
    const r2 = convertAmount(2, 3, 1500n)
    expect(r2.toAmount).toBe(1n)
    expect(r2.dust).toBe(500_000n)
  })

  it("too-small reverts semantics (0 output)", () => {
    const r = convertAmount(1, 3, 999n)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("too-small")
    expect(r.dust).toBe(999n)
  })

  it("same type rejected", () => {
    const r = convertAmount(2, 2, 5n)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("same-type")
  })

  it("invalid types rejected", () => {
    expect(convertAmount(1, 4, 1n).error).toBe("invalid-type")
    expect(convertAmount(0, 1, 1n).error).toBe("invalid-type")
    expect(isValidType(1)).toBe(true)
    expect(isValidType(4)).toBe(false)
  })

  it("zero/negative amounts rejected", () => {
    expect(convertAmount(1, 2, 0n).error).toBe("zero-amount")
    expect(convertAmount(1, 2, -5n).error).toBe("zero-amount")
  })

  it("rate text is canonical", () => {
    expect(MEGA_RATE_TEXT).toBe("1 CINA = 1,000 MCINA = 1,000,000 UCINA")
  })
})
