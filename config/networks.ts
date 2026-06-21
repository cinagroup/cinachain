// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { http } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const rpcEndpoint = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT

// Use public fallback if custom RPC is not available or CORS fails
const rpcUrl =
  rpcEndpoint && rpcToken
    ? `${rpcEndpoint}?token=${rpcToken}`
    : undefined

// Public fallback RPCs (no CORS issues)
const publicRpcUrl = "https://eth.llamarpc.com"

export const chains = [mainnet, sepolia, base] as const

export const transports = {
  [mainnet.id]: http(rpcUrl || publicRpcUrl, {
    batch: false, // Disable batching to avoid CORS preflight issues
    timeout: 30000,
  }),
  [sepolia.id]: http("https://rpc.sepolia.org"),
  [base.id]: http("https://mainnet.base.org"),
} as const
