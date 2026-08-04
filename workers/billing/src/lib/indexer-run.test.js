import { describe, it, expect } from "vitest"
import { parseTransferLogs, nextCursorRange, selectAddressLogs } from "./indexer-run.js"

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f"

describe("parseTransferLogs", () => {
  it("decodes from/to/value from raw eth_getLogs payload", () => {
    const logs = [
      {
        topics: [TRANSFER_TOPIC,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
        blockNumber: "0x10",
      },
      {
        topics: [TRANSFER_TOPIC,
          "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
        data: "0x0000000000000000000000000000000000000000000000000000000000000064",
        blockNumber: "0x11",
      },
    ]
    const parsed = parseTransferLogs(logs)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({
      from: "0x0000000000000000000000000000000000000000",
      to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      value: 1_000_000_000_000_000_000n,
    })
    expect(parsed[1].from).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(parsed[1].to).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    expect(parsed[1].value).toBe(100n)
  })
})

describe("nextCursorRange", () => {
  it("caps range at MAX_BLOCKS_PER_CALL", () => {
    expect(nextCursorRange(100n, 100_000n, 5000n)).toEqual({ from: 101n, to: 5100n })
  })
  it("clamps to latest", () => {
    expect(nextCursorRange(100n, 4000n, 5000n)).toEqual({ from: 101n, to: 4000n })
  })
  it("returns null when caught up", () => {
    expect(nextCursorRange(4000n, 4000n, 5000n)).toBeNull()
  })
})

describe("selectAddressLogs", () => {
  it("filters logs touching a given address (either side)", () => {
    const logs = [
      { from: "0x0000000000000000000000000000000000000000", to: "0xaaa", value: 1n },
      { from: "0xaaa", to: "0xbbb", value: 2n },
      { from: "0xccc", to: "0xddd", value: 3n },
    ]
    expect(selectAddressLogs(logs, "0xaaa")).toHaveLength(2)
    expect(selectAddressLogs(logs, "0xddd")).toHaveLength(1)
  })
})
