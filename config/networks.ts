// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. RPC auth (if needed) must be proxied through
// a Cloudflare Worker that injects the token server-side.
import { fallback, http } from "wagmi"

import { PRIMARY_CHAIN } from "./deployment"

// Preserve the existing metadata exports for downstream compatibility while
// keeping metadata-only consumers on config/deployment.
export * from "./deployment"

// Contracts are deployed on Base Sepolia (testnet).
// When deploying to Base Mainnet, swap to [base] and update contract addresses.
export const chains: [typeof PRIMARY_CHAIN] = [PRIMARY_CHAIN]

// Public RPC endpoints with reliability-tested fallbacks.
const BASE_SEPOLIA_RPC = fallback([
  http("https://sepolia.base.org", { batch: false, timeout: 30_000 }),
  http("https://base-sepolia.publicnode.com", {
    batch: false,
    timeout: 30_000,
  }),
])

export const transports = {
  [PRIMARY_CHAIN.id]: BASE_SEPOLIA_RPC,
} as const
