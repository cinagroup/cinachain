export type AccountType = "sa" | "coinbase-smart-wallet" | "eoa"

export type RouteDecision =
  | { kind: "smart-account" } // Reown SA: plain writeContract — the iframe builds the UserOp + sponsors gas
  | { kind: "coinbase"; capabilities: { paymasterService: { url: string } } } // EIP-5792 sendCalls + paymaster
  | { kind: "eoa" } // plain writeContract — user pays gas normally

/**
 * Pure paymaster-routing decision — the single source of truth for the
 * account-type x capability matrix (kept React-free so it is unit-testable
 * without mocks; see lib/__tests__/paymaster-route.test.ts).
 *
 * Matrix:
 * - Reown smart account ("sa")      -> smart-account (AppKit/iframe handles UserOp + paymaster internally)
 * - Coinbase Smart Wallet + EIP-5792 paymasterService.supported + proxy URL
 *                                    -> coinbase (capabilities attached to sendCalls)
 * - anything else (EOA, unknown chain, missing URL, still-loading caps,
 *   disconnected)                   -> eoa
 */
export function routePaymaster(opts: {
  accountType: AccountType | null
  chainId?: number
  available?: Record<number, { paymasterService?: { supported?: boolean } }>
  paymasterProxyUrl?: string
}): RouteDecision {
  if (opts.accountType === "sa") {
    return { kind: "smart-account" }
  }
  const chainCaps = opts.available?.[opts.chainId ?? 0]
  if (opts.paymasterProxyUrl && chainCaps?.paymasterService?.supported) {
    return {
      kind: "coinbase",
      capabilities: { paymasterService: { url: opts.paymasterProxyUrl } },
    }
  }
  return { kind: "eoa" }
}
