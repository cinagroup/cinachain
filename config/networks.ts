// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Networks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { http } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const baseRpcToken = process.env.CF_BASE_RPC_SERVICE_AUTH_TOKEN

export const chains = [mainnet, sepolia, base] as const

export const transports = {
  [mainnet.id]: http(
    rpcToken
      ? `https://mainnet-rpc.cinachain.com?token=${rpcToken}`
      : "https://ethereum.publicnode.com",
    { batch: false, timeout: 30000 }
  ),
  [sepolia.id]: http("https://rpc.sepolia.org"),
  [base.id]: http(
    baseRpcToken
      ? `https://base-rpc.cinachain.com?token=${baseRpcToken}`
      : "https://mainnet.base.org",
    { batch: false, timeout: 30000 }
  ),
} as const
