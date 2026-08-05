// Shared error message extraction for wagmi/viem errors.
//
// viem nests the on-chain revert reason several layers deep:
//   ContractFunctionExecutionError → CallExecutionError → RevertError
// A one-level `cause?.reason` check (as used before) surfaced only the
// generic "The contract function 'x' reverted." instead of the actual
// reason ("ExchangeTooSmall", "MintCapExceeded", "Insufficient balance").
// Walk the cause chain and prefer the deepest concrete reason/details.

interface ViemErrorShape {
  reason?: string
  shortMessage?: string
  message?: string
  details?: string
  cause?: { reason?: string; shortMessage?: string; details?: string; cause?: unknown }
}

export function extractErrorMessage(err: unknown): string {
  let current: unknown = err
  let fallback = "Unknown error"

  for (let depth = 0; depth < 6 && current != null; depth++) {
    const e = current as ViemErrorShape
    // The deepest specific reason/details win (RevertError carries `reason`
    // on itself; wrappers carry it one level down in cause.reason).
    if (typeof e?.reason === "string" && e.reason) return e.reason
    if (typeof e?.details === "string" && e.details) return e.details
    if (typeof e?.cause?.reason === "string" && e.cause.reason) return e.cause.reason
    if (typeof e?.shortMessage === "string" && e.shortMessage) {
      // Innermost shortMessage wins (outer wrappers are the most generic).
      fallback = e.shortMessage
    }
    const cause = e?.cause
    current = (cause as { cause?: unknown })?.cause ?? cause
  }
  return fallback
}
