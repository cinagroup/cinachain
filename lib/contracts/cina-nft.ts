import { readContract } from "@wagmi/core"
import { parseAbiItem } from "viem"
import { wagmiConfig } from "@/components/providers/rainbow-kit"

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`

const ABI = [
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem("function ownerOf(uint256 tokenId) view returns (address)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),
  parseAbiItem("function name() view returns (string)"),
  parseAbiItem("function symbol() view returns (string)"),
] as const

export function getCinaNftContract() {
  return {
    address: CONTRACT_ADDRESS,
    read: {
      totalSupply: () =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "totalSupply",
        }),
      tokenURI: (args: [bigint]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "tokenURI",
          args,
        }),
      ownerOf: (args: [bigint]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "ownerOf",
          args,
        }),
      balanceOf: (args: [`0x${string}`]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "balanceOf",
          args,
        }),
      name: () =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "name",
        }),
      symbol: () =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "symbol",
        }),
    },
  }
}
