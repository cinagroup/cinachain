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
