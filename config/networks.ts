// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. RPC auth (if needed) must be proxied through
// a Cloudflare Worker that injects the token server-side.
import { http, fallback } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

// Chains exposed to the RainbowKit picker. The DApp's contract calls are
// mainnet-only, but we keep base/sepolia available for testing/debugging.
export const chains = [mainnet, sepolia, base] as const

// Public RPC endpoints with reliability-tested fallbacks.
// For authenticated Cloudflare Web3 Gateways, deploy the rpc-proxy Worker
// and point the primary URL at the Worker domain.
const MAINNET_RPC = fallback([
  http("https://ethereum.publicnode.com", { batch: false, timeout: 30_000 }),
  http("https://cloudflare-eth.com", { batch: false, timeout: 30_000 }),
  http("https://rpc.ankr.com/eth", { batch: false, timeout: 30_000 }),
])

const SEPOLIA_RPC = fallback([
  http("https://ethereum-sepolia.publicnode.com", {
    batch: false,
    timeout: 30_000,
  }),
  http("https://rpc.sepolia.org", { batch: false, timeout: 30_000 }),
])

const BASE_RPC = fallback([
  http("https://mainnet.base.org", { batch: false, timeout: 30_000 }),
  http("https://base.publicnode.com", { batch: false, timeout: 30_000 }),
])

export const transports = {
  [mainnet.id]: MAINNET_RPC,
  [sepolia.id]: SEPOLIA_RPC,
  [base.id]: BASE_RPC,
} as const
