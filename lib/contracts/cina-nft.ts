import { createPublicClient, http, type PublicClient } from "viem"
import { mainnet } from "wagmi/chains"
import { parseAbiItem } from "viem"
import { CINA_NFT_CONTRACT } from "@/lib/contracts/addresses"

const ABI = [
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem("function ownerOf(uint256 tokenId) view returns (address)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),
  parseAbiItem("function name() view returns (string)"),
  parseAbiItem("function symbol() view returns (string)"),
  parseAbiItem("function mintPrice() view returns (uint256)"),
  parseAbiItem("function paused() view returns (bool)"),
] as const

// Singleton public client — avoids rebuilding the client on every call.
let _client: PublicClient | null = null
function getPublicClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: mainnet,
      // Use a reliable public RPC; for authenticated reads, point this at
      // the rpc-proxy Worker (no secret tokens in client code).
      transport: http("https://ethereum.publicnode.com"),
    })
  }
  return _client
}

export const cinaNftAbi = ABI
export const CINA_NFT_ADDRESS = CINA_NFT_CONTRACT

export function getCinaNftContract() {
  const client = getPublicClient()
  return {
    address: CINA_NFT_CONTRACT,
    abi: ABI,
    read: {
      totalSupply: () =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "totalSupply",
        }),
      tokenURI: (args: [bigint]) =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "tokenURI",
          args,
        }),
      ownerOf: (args: [bigint]) =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "ownerOf",
          args,
        }),
      balanceOf: (args: [`0x${string}`]) =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "balanceOf",
          args,
        }),
      name: () =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "name",
        }),
      symbol: () =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "symbol",
        }),
      mintPrice: () =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "mintPrice",
        }),
      paused: () =>
        client.readContract({
          address: CINA_NFT_CONTRACT,
          abi: ABI,
          functionName: "paused",
        }),
    },
  }
}
