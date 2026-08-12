// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks — wagmi chain & transport configuration
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IMPORTANT: This module is imported by client components. Never read
// server-only env vars here. The Alchemy key is injected server-side by the
// rpc-proxy Worker; the browser reaches that Worker via NEXT_PUBLIC_BASE_RPC
// (https://base-rpc.cinachain.com), so the key never enters the frontend
// bundle and browser CORS / referrer-allowlist issues cannot occur.
import { fallback, http } from "wagmi"

import { env } from "../env.mjs"
import { PRIMARY_CHAIN } from "./deployment"

// Preserve the existing metadata exports for downstream compatibility while
// keeping metadata-only consumers on config/deployment.
export * from "./deployment"

// Contracts are deployed on Base Sepolia (testnet).
// When deploying to Base Mainnet, swap to [base] and update contract addresses.
export const chains: [typeof PRIMARY_CHAIN] = [PRIMARY_CHAIN]

// Primary RPC: the self-hosted rpc-proxy Worker (base-rpc.cinachain.com). The
// Worker proxies Alchemy server-side with the public endpoints as fallback, so
// a single browser request benefits from Alchemy's dedicated quota without the
// key ever leaving the Worker. Falls through to the public endpoints directly
// when NEXT_PUBLIC_BASE_RPC is unset (local dev without the Worker, CI, or a
// deploy in flight) so the app always loads.
const workerRpc = env.NEXT_PUBLIC_BASE_RPC
  ? http(env.NEXT_PUBLIC_BASE_RPC, { batch: false, timeout: 30_000 })
  : null

// rank:false disables viem's auto-ranking (which reorders transports by
// measured latency and could demote the Worker behind the public endpoints) —
// we want strict priority order: Worker first, public endpoints only on failure.
const BASE_SEPOLIA_RPC = fallback(
  [
    ...(workerRpc ? [workerRpc] : []),
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
