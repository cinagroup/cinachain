// workers/billing/src/lib/indexer.js
// Pure transfer-log application — keeps the on-chain balance snapshot fresh.
const ZERO = "0x0000000000000000000000000000000000000000"

// Returns the new balance of the tracked side: the sender when the sender is
// tracked (transfer-out), otherwise the recipient (mint / transfer-in).
export function applyTransferLog({ from, to, value }, snapshots) {
  const fromK = from.toLowerCase()
  const toK = to.toLowerCase()
  if (from.toLowerCase() === to.toLowerCase()) return snapshots[from.toLowerCase()] ?? 0n
  if (fromK !== ZERO && Object.hasOwn(snapshots, fromK)) {
    const cur = snapshots[fromK] ?? 0n
    return cur > value ? cur - value : 0n
  }
  const cur = snapshots[toK] ?? 0n
  return cur + value
}

export function mergeTransfers(logs, snapshots) {
  const next = { ...snapshots }
  for (const log of logs) {
    const { from, to, value } = log
    const fromK = from.toLowerCase()
    const toK = to.toLowerCase()
    if (fromK === toK) continue
    if (fromK !== ZERO) {
      const cur = next[fromK] ?? 0n
      next[fromK] = cur > value ? cur - value : 0n
    }
    const curTo = next[toK] ?? 0n
    next[toK] = curTo + value
  }
  return next
}
