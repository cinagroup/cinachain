import { describe, expect, it } from "vitest"

import { getChainReadStatus } from "../chain-read-state"

const completeRead = {
  isConfigured: true,
  isPending: false,
  hasData: true,
  hasError: false,
  isRefetchError: false,
  isEmpty: false,
}

describe("getChainReadStatus", () => {
  it("reports loading before the first complete response", () => {
    expect(
      getChainReadStatus({
        ...completeRead,
        isPending: true,
        hasData: false,
      })
    ).toBe("loading")
  })

  it("reports success for complete non-empty data", () => {
    expect(getChainReadStatus(completeRead)).toBe("success")
  })

  it("reports empty only after a complete successful read", () => {
    expect(getChainReadStatus({ ...completeRead, isEmpty: true })).toBe("empty")
    expect(
      getChainReadStatus({
        ...completeRead,
        hasData: false,
        hasError: true,
        isEmpty: true,
      })
    ).toBe("error")
  })

  it("reports error for failed or incomplete initial reads", () => {
    expect(
      getChainReadStatus({
        ...completeRead,
        hasData: false,
        hasError: true,
      })
    ).toBe("error")
    expect(
      getChainReadStatus({
        ...completeRead,
        isConfigured: false,
        hasData: false,
      })
    ).toBe("error")
  })

  it("reports stale only when a refresh fails with complete cached data", () => {
    expect(
      getChainReadStatus({
        ...completeRead,
        hasError: true,
        isRefetchError: true,
      })
    ).toBe("stale")
    expect(
      getChainReadStatus({
        ...completeRead,
        hasData: false,
        hasError: true,
        isRefetchError: true,
      })
    ).toBe("error")
  })
})
