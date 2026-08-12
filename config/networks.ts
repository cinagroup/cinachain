// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. RPC auth (if needed) must be proxied through
// a Cloudflare Worker that injects the token server-side.
import { fallback, http } from "wagmi"

import { env } from "../env.mjs"
import { PRIMARY_CHAIN } from "./deployment"

// Preserve the existing metadata exports for downstream compatibility while
// keeping metadata-only consumers on config/deployment.
export * from "./deployment"

// Contracts are deployed on Base Sepolia (testnet).
// When deploying to Base Mainnet, swap to [base] and update contract addresses.
export const chains: [typeof PRIMARY_CHAIN] = [PRIMARY_CHAIN]

// Alchemy is the primary RPC when an API key is configured: dedicated rate
// limit, SLA, and Base L2-optimised endpoints. Falls through to the two
// public endpoints so the app still works without a key (local dev, CI, or
// before Alchemy is provisioned).
const alchemyRpc = env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? http(
      `https://base-sepolia.g.alchemy.com/v2/${env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      { batch: false, timeout: 30_000 }
    )
  : null

// Public RPC endpoints with reliability-tested fallbacks. rank:false disables
// viem's auto-ranking (which reorders transports by measured latency and could
// deprioritise the paid Alchemy endpoint) — we want strict priority order:
// Alchemy first, public endpoints only as failure fallback.
const BASE_SEPOLIA_RPC = fallback(
  [
    ...(alchemyRpc ? [alchemyRpc] : []),
    http("https://sepolia.base.org", { batch: false, timeout: 30_000 }),
    http("https://base-sepolia.publicnode.com", {
      batch: false,
      timeout: 30_000,
    }),
  ],
  { rank: false }
)

export const transports = {
  [PRIMARY_CHAIN.id]: BASE_SEPOLIA_RPC,
} as const
