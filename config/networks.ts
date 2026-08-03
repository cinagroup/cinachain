// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. RPC auth (if needed) must be proxied through
// a Cloudflare Worker that injects the token server-side.
import { http, fallback } from "wagmi"
import { base, baseSepolia, mainnet } from "wagmi/chains"

// Primary chain: Base L2 (100-500x cheaper gas than Ethereum mainnet)
// Secondary: Base Sepolia (testnet), Ethereum mainnet (fallback)
export const chains = [base, baseSepolia, mainnet] as const

// The chain where the NFT contract is deployed
export const PRIMARY_CHAIN_ID = base.id // 8453

// Public RPC endpoints with reliability-tested fallbacks.
const BASE_RPC = fallback([
  http("https://mainnet.base.org", { batch: false, timeout: 30_000 }),
  http("https://base.publicnode.com", { batch: false, timeout: 30_000 }),
])

const BASE_SEPOLIA_RPC = fallback([
  http("https://sepolia.base.org", { batch: false, timeout: 30_000 }),
  http("https://base-sepolia.publicnode.com", { batch: false, timeout: 30_000 }),
])

const MAINNET_RPC = fallback([
  http("https://ethereum.publicnode.com", { batch: false, timeout: 30_000 }),
  http("https://cloudflare-eth.com", { batch: false, timeout: 30_000 }),
])

export const transports = {
  [base.id]: BASE_RPC,
  [baseSepolia.id]: BASE_SEPOLIA_RPC,
  [mainnet.id]: MAINNET_RPC,
} as const

// Block explorer base URL for the primary chain (Base)
export const EXPLORER_URL = "https://api.basescan.org"
export const EXPLORER_LINK = "https://basescan.org"
