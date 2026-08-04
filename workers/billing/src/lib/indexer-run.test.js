import { describe, it, expect } from "vitest"
import { parseTransferLogs, nextCursorRange, selectAddressLogs, applyLogsToSnapshot, runIndexer, listAllKeys } from "./indexer-run.js"

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

describe("applyLogsToSnapshot", () => {
  it("returns the same snapshot value when no logs touch the address", () => {
    const logs = [{ from: "0xccc", to: "0xddd", value: 3n }]
    expect(applyLogsToSnapshot(logs, "0xaaa", 100n)).toBe(100n)
  })
  it("adds to the snapshot on mint (from is the zero address)", () => {
    const logs = [
      { from: "0x0000000000000000000000000000000000000000", to: "0xaaa", value: 100n },
    ]
    expect(applyLogsToSnapshot(logs, "0xaaa", 50n)).toBe(150n)
  })
  it("subtracts on transfer-out and floors at 0 when value exceeds snapshot", () => {
    const out = [{ from: "0xaaa", to: "0xbbb", value: 30n }]
    expect(applyLogsToSnapshot(out, "0xaaa", 100n)).toBe(70n)
    expect(applyLogsToSnapshot(out, "0xaaa", 10n)).toBe(0n)
  })
  it("leaves the snapshot unchanged on self-transfer", () => {
    const logs = [{ from: "0xaaa", to: "0xaaa", value: 5n }]
    expect(applyLogsToSnapshot(logs, "0xaaa", 100n)).toBe(100n)
  })
})

function mockKv(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null },
    async put(k, v) { store.set(k, v) },
    async list({ prefix } = {}) {
      return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }
    },
  }
}

describe("runIndexer", () => {
  it("updates ledger snapshots from transfer logs and advances cursor", async () => {
    const kv = mockKv({
      // pre-seeded cursor forces a scan window (cold start would seed at latest)
      "idx:lastBlock": "0",
      "ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": JSON.stringify({ onchainSnapshot: "1000000000000000000", committedUsage: "0", cumulativeSpend: "0" }),
    })
    const fakeEnv = {
      CINA_BILLING_KV: kv,
      BASE_SEPOLIA_RPC: "https://fake",
      CINA_CREDIT_ADDRESS: "0xcredit",
    }
    // latest = 0x10, one transfer-out of 200 wei from 0xaaa
    const calls = []
    const getLogsParams = []
    global.fetch = async (url, opts) => {
      const body = JSON.parse(opts.body)
      calls.push(body.method)
      if (body.method === "eth_blockNumber") {
        return { json: async () => ({ result: "0x10" }) }
      }
      if (body.method === "eth_getLogs") {
        getLogsParams.push(body.params)
        return { json: async () => ({ result: [{
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f",
            "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ],
          data: "0x00000000000000000000000000000000000000000000000000000000000000c8",
          blockNumber: "0x10",
        }] }) }
      }
      throw new Error(`unexpected method ${body.method}`)
    }
    const res = await runIndexer(fakeEnv)
    expect(calls).toContain("eth_blockNumber")
    expect(calls).toHaveLength(2) // eth_blockNumber + eth_getLogs, no other RPCs
    expect(getLogsParams).toHaveLength(1)
    expect(getLogsParams[0][0].fromBlock).toBe("0x1")
    expect(getLogsParams[0][0].toBlock).toBe("0x10")
    expect(res.updated).toBe(1)
    const stored = JSON.parse(kv.store.get("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
    expect(stored.onchainSnapshot).toBe("999999999999999800") // 1e18 - 200
    expect(kv.store.get("idx:lastBlock")).toBe("16")
  })

  it("cold start: seeds cursor at latest without backfill", async () => {
    const kv = mockKv({})
    const fakeEnv = { CINA_BILLING_KV: kv, BASE_SEPOLIA_RPC: "https://fake", CINA_CREDIT_ADDRESS: "0xcredit" }
    global.fetch = async () => ({ json: async () => ({ result: "0x1234" }) })
    const res = await runIndexer(fakeEnv)
    expect(res.updated).toBe(0)
    expect(kv.store.get("idx:lastBlock")).toBe("4660")
  })
})

describe("listAllKeys", () => {
  it("paginates KV list cursor", async () => {
    const keys = Array.from({ length: 1200 }, (_, i) => ({ name: `ledger:0x${i.toString(16).padStart(40, "0")}` }))
    const kv = {
      async list({ prefix, cursor } = {}) {
        const start = cursor ? Number(cursor) : 0
        const slice = keys.slice(start, start + 1000)
        return { keys: slice, cursor: start + 1000 < keys.length ? String(start + 1000) : undefined }
      },
    }
    const all = await listAllKeys(kv, "ledger:")
    expect(all).toHaveLength(1200)
  })
})
