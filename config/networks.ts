// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { http } from "wagmi"
import { mainnet, sepolia } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const rpcEndpoint = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT

const rpcUrl =
  rpcEndpoint && rpcToken
    ? `${rpcEndpoint}?token=${rpcToken}`
    : rpcEndpoint || undefined

export const chains = [mainnet, sepolia] as const

export const transports = {
  [mainnet.id]: http(rpcUrl, {
    batch: true,
    cacheTime: 1000 * 60 * 5,
  }),
  [sepolia.id]: http(),
} as const
