// Public deployment metadata. This module intentionally has no wagmi
// transports or client-only state so it is safe to import from metadata,
// server components, static pages, and tests.
import { baseSepolia } from "viem/chains"

export const PRIMARY_CHAIN = baseSepolia
export const PRIMARY_CHAIN_ID = PRIMARY_CHAIN.id

export const PRIMARY_NETWORK_NAME = PRIMARY_CHAIN.name
export const PRIMARY_NETWORK_ENVIRONMENT = PRIMARY_CHAIN.testnet
  ? "Testnet"
  : "Mainnet"
export const PRIMARY_NETWORK_LABEL = `${PRIMARY_NETWORK_NAME} ${PRIMARY_NETWORK_ENVIRONMENT}`
export const DEPLOYMENT_STAGE = PRIMARY_CHAIN.testnet ? "Beta" : "Live"

export const EXPLORER_LINK = PRIMARY_CHAIN.blockExplorers.default.url
export const EXPLORER_NAME = PRIMARY_CHAIN.blockExplorers.default.name
export const EXPLORER_API_URL =
  PRIMARY_CHAIN.blockExplorers.default.apiUrl ??
  "https://api-sepolia.basescan.org/api"

// Kept for compatibility with the original config export. Prefer
// EXPLORER_API_URL for new API consumers and EXPLORER_LINK for public links.
export const EXPLORER_URL = new URL(EXPLORER_API_URL).origin

export type ExplorerResource = "address" | "token" | "tx"

/** Build a public explorer link for data that belongs to the primary chain. */
export function getBlockExplorerUrl(
  resource: ExplorerResource,
  identifier: string,
  query?: Readonly<Record<string, string | number | bigint | undefined>>
): string {
  const base = `${EXPLORER_LINK}/${resource}/${encodeURIComponent(identifier)}`
  if (!query) return base

  const search = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })

  const serialized = search.toString()
  return serialized ? `${base}?${serialized}` : base
}
