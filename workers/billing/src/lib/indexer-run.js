// workers/billing/src/lib/indexer-run.js
// Scheduled event indexer: polls CinaCredit Transfer events and applies
// incremental deltas to per-address ledger snapshots (spec §4.3).
import { mergeTransfers } from "./indexer.js"

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f"
export const MAX_BLOCKS_PER_CALL = 5000n

function hexToAddress(topic) {
  return `0x${topic.slice(26)}`.toLowerCase()
}

/** Decode raw eth_getLogs Transfer payloads into {from,to,value} */
export function parseTransferLogs(logs) {
  return logs.map((l) => ({
    from: hexToAddress(l.topics[1]),
    to: hexToAddress(l.topics[2]),
    value: BigInt(l.data),
  }))
}

/** Next [from,to] inclusive block range, or null when caught up */
export function nextCursorRange(cursor, latest, chunk = MAX_BLOCKS_PER_CALL) {
  if (cursor >= latest) return null
  const from = cursor + 1n
  const to = from + chunk - 1n > latest ? latest : from + chunk - 1n
  return { from, to }
}

/** Logs touching an address on either side (from OR to) */
export function selectAddressLogs(logs, address) {
  return logs.filter((l) => l.from === address || l.to === address)
}

/**
 * Apply a batch of transfer logs to one address's current snapshot using
 * the immutable mergeTransfers semantics (mint adds, out subtracts floor 0).
 */
export function applyLogsToSnapshot(logs, address, current) {
  const touched = selectAddressLogs(logs, address)
  if (!touched.length) return current
  return mergeTransfers(touched, { [address]: current })[address]
}

async function rpcCall(rpc, method, params = []) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  })
  const j = await res.json()
  if (j.error) throw new Error(j.error.message ?? `${method} failed`)
  return j.result
}

async function fetchTransferLogs(env, fromBlock, toBlock) {
  const rpc = env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  const result = await rpcCall(rpc, "eth_getLogs", [
    {
      address: env.CINA_CREDIT_ADDRESS,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      topics: [TRANSFER_TOPIC],
    },
  ])
  return parseTransferLogs(result ?? [])
}

/** Paginate a KV list() across the 1000-key page limit */
export async function listAllKeys(kv, prefix) {
  const out = []
  let cursor
  do {
    const page = await kv.list({ prefix, ...(cursor ? { cursor } : {}) })
    out.push(...page.keys)
    cursor = page.cursor
  } while (cursor)
  return out
}

/**
 * One indexer pass: advance cursor, pull Transfer logs, apply deltas to
 * every ledger row we track. Returns {scanned, updated, cursor}.
 * Cold start (no cursor yet): seed cursor at latest, no backfill — existing
 * balances are covered by the request-path RPC snapshot (refreshSnapshot).
 *
 * Accepted caveats (spec §4.3 known limits):
 * - New-ledger double-application window: a ledger row created at request
 *   time via refreshSnapshot carries a snapshot already as-of its creation
 *   block N > cursor, so deltas for (cursor, N] would apply twice. Transient
 *   — the next request-path usage re-syncs from RPC. Future fix: persist an
 *   asOfBlock on the ledger row and skip ranges already covered by it.
 * - No mutual exclusion with itself or the request path: overlapping runs
 *   may double-apply deltas, but identical-value last-write-wins makes that
 *   benign. Same accepted cross-isolate KV stance as withLedgerLock
 *   (see index.js:19-22).
 */
export async function runIndexer(env) {
  const kv = env.CINA_BILLING_KV
  const latest = BigInt(await rpcCall(env.BASE_SEPOLIA_RPC || "https://sepolia.base.org", "eth_blockNumber"))
  const cursorRaw = await kv.get("idx:lastBlock")
  const cursor = cursorRaw ? BigInt(cursorRaw) : latest
  // cold start: persist the cursor so the next run scans forward
  if (!cursorRaw) await kv.put("idx:lastBlock", cursor.toString())
  const range = nextCursorRange(cursor, latest)
  if (!range) return { scanned: "0", updated: 0, cursor: cursor.toString() }

  const logs = await fetchTransferLogs(env, range.from, range.to)
  const ledgerKeys = await listAllKeys(kv, "ledger:")
  let updated = 0
  for (const { name } of ledgerKeys) {
    const addr = name.slice("ledger:".length)
    const raw = await kv.get(name)
    if (!raw) continue
    try {
      const ledger = JSON.parse(raw)
      const current = BigInt(ledger.onchainSnapshot ?? 0)
      const next = applyLogsToSnapshot(logs, addr, current)
      if (next !== current) {
        ledger.onchainSnapshot = next.toString()
        await kv.put(name, JSON.stringify(ledger))
        updated++
      }
    } catch (err) {
      // One malformed row (e.g. manual/console edit) must not abort the run
      // before the cursor write-back — skip it and carry on.
      console.error(`[indexer] skipping malformed ledger row ${name}:`, err?.message ?? err)
    }
  }
  await kv.put("idx:lastBlock", range.to.toString())
  return { scanned: (range.to - range.from + 1n).toString(), updated, cursor: range.to.toString() }
}
