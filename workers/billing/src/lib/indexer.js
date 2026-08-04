// workers/billing/src/lib/indexer.js
// Pure transfer-log application — keeps the on-chain balance snapshot fresh.
const ZERO = "0x0000000000000000000000000000000000000000"

export function applyTransferLog({ from, to, value }, snapshots) {
  const fromK = from.toLowerCase()
  const toK = to.toLowerCase()
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
    if (fromK !== ZERO) {
      const cur = next[fromK] ?? 0n
      next[fromK] = cur > value ? cur - value : 0n
    }
    const curTo = next[toK] ?? 0n
    next[toK] = curTo + value
  }
  return next
}
