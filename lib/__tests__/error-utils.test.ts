import { describe, it, expect } from "vitest"
import { extractErrorMessage } from "../error-utils"

describe("extractErrorMessage", () => {
  it("returns nested cause.reason (viem RevertError)", () => {
    const err = {
      shortMessage: "The contract function 'exchange' reverted.",
      cause: {
        shortMessage: "The contract function 'exchange' reverted.",
        cause: { reason: "ExchangeTooSmall()" },
      },
    }
    expect(extractErrorMessage(err)).toBe("ExchangeTooSmall()")
  })

  it("returns shortMessage when no deeper reason", () => {
    const err = { shortMessage: "insufficient funds for gas" }
    expect(extractErrorMessage(err)).toBe("insufficient funds for gas")
  })

  it("prefers details when present", () => {
    const err = { shortMessage: "x", details: "MintCapExceeded" }
    expect(extractErrorMessage(err)).toBe("MintCapExceeded")
  })

  it("falls back through multi-level causes", () => {
    const err = {
      cause: {
        cause: {
          cause: { reason: "deep reason" },
        },
      },
    }
    expect(extractErrorMessage(err)).toBe("deep reason")
  })

  it("returns Unknown error for non-errors", () => {
    expect(extractErrorMessage(undefined)).toBe("Unknown error")
    expect(extractErrorMessage(null)).toBe("Unknown error")
    expect(extractErrorMessage("boom")).toBe("Unknown error")
  })
})
