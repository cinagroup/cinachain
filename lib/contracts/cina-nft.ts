import { createPublicClient, http } from "viem"
import { parseAbiItem } from "viem"
import { mainnet } from "viem/chains"

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

function getPublicClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT
    ? `${process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT}?token=${process.env.CF_RPC_SERVICE_AUTH_TOKEN}`
    : undefined

  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })
}

export function getCinaNftContract() {
  const client = getPublicClient()

  return {
    address: CONTRACT_ADDRESS,
    abi: ABI,
    read: {
      totalSupply: () =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "totalSupply",
        }),
      tokenURI: (args: [bigint]) =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "tokenURI",
          args,
        }),
      ownerOf: (args: [bigint]) =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "ownerOf",
          args,
        }),
      balanceOf: (args: [`0x${string}`]) =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "balanceOf",
          args,
        }),
      name: () =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "name",
        }),
      symbol: () =>
        client.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "symbol",
        }),
    },
  }
}
