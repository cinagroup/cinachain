// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { http } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const rpcEndpoint = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT

const rpcUrl =
  rpcEndpoint && rpcToken
    ? `${rpcEndpoint}?token=${rpcToken}`
    : rpcEndpoint || undefined

export const chains = [mainnet, sepolia, base] as const

export const transports = {
  [mainnet.id]: http(rpcUrl, {
    batch: true,
  }),
  [sepolia.id]: http(),
  [base.id]: http(),
} as const
