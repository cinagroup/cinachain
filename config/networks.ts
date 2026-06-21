// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { http } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const rpcEndpoint = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT

// RPC Proxy Worker (solves CORS issues)
// Deployed at: https://rpc-proxy.cinagroup.workers.dev
// Custom domain: rpc.cinachain.com (configure in Cloudflare Dashboard)
const workerRpcUrl = "https://rpc-proxy.cinagroup.workers.dev"

// Custom RPC Gateway (if configured in Cloudflare Dashboard)
const customRpcUrl =
  rpcEndpoint && rpcToken
    ? `${rpcEndpoint}?token=${rpcToken}`
    : undefined

export const chains = [mainnet, sepolia, base] as const

export const transports = {
  [mainnet.id]: http(customRpcUrl || workerRpcUrl, {
    batch: false, // Disable batching to avoid CORS preflight issues
    timeout: 30000,
  }),
  [sepolia.id]: http("https://rpc.sepolia.org"),
  [base.id]: http("https://mainnet.base.org"),
} as const
