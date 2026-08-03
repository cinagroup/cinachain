// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. RPC auth (if needed) must be proxied through
// a Cloudflare Worker that injects the token server-side.
import { http, fallback } from "wagmi"
import { baseSepolia } from "wagmi/chains"

// Contracts are deployed on Base Sepolia (testnet).
// When deploying to Base Mainnet, swap to [base] and update contract addresses.
export const chains = [baseSepolia] as const

// The chain where the NFT contract is deployed
export const PRIMARY_CHAIN_ID = baseSepolia.id // 84532

// Public RPC endpoints with reliability-tested fallbacks.
const BASE_SEPOLIA_RPC = fallback([
  http("https://sepolia.base.org", { batch: false, timeout: 30_000 }),
  http("https://base-sepolia.publicnode.com", { batch: false, timeout: 30_000 }),
])

export const transports = {
  [baseSepolia.id]: BASE_SEPOLIA_RPC,
} as const

// Block explorer base URL for the primary chain
export const EXPLORER_URL = "https://api-sepolia.basescan.org"
export const EXPLORER_LINK = "https://sepolia.basescan.org"
