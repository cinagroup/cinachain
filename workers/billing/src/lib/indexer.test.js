import { describe, it, expect } from "vitest"
import { applyTransferLog, mergeTransfers } from "./indexer.js"

describe("applyTransferLog", () => {
  it("mint (from=0) adds to snapshot", () => {
    expect(applyTransferLog({ from: "0x0000000000000000000000000000000000000000", to: "0xa", value: 500n }, { "0xa": 0n })).toBe(500n)
  })
  it("incoming transfer adds", () => {
    expect(applyTransferLog({ from: "0xb", to: "0xa", value: 100n }, { "0xa": 900n })).toBe(1000n)
  })
  it("outgoing transfer subtracts (floor 0)", () => {
    expect(applyTransferLog({ from: "0xa", to: "0xb", value: 400n }, { "0xa": 900n })).toBe(500n)
    expect(applyTransferLog({ from: "0xa", to: "0xb", value: 5000n }, { "0xa": 900n })).toBe(0n)
  })
})

describe("mergeTransfers", () => {
  it("applies a batch in order", () => {
    const logs = [
      { from: "0x0000000000000000000000000000000000000000", to: "0xa", value: 1000n },
      { from: "0xa", to: "0xb", value: 300n },
    ]
    expect(mergeTransfers(logs, { "0xa": 0n, "0xb": 0n })).toEqual({ "0xa": 700n, "0xb": 300n })
  })
  it("case-insensitive address keys", () => {
    const logs = [{ from: "0x0000000000000000000000000000000000000000", to: "0xA", value: 100n }]
    expect(mergeTransfers(logs, { "0xa": 0n })).toEqual({ "0xa": 100n })
  })
})
