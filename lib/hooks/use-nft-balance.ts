import { useReadContract } from "wagmi"
import { Address } from "viem"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as Address

const BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

/**
 * 查询用户持有的 NFT 数量
 * @param address 用户钱包地址
 */
export function useNftBalance(address?: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })
}
