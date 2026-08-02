import { useReadContract, useReadContracts } from "wagmi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"

const ENUM_ABI = [
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

/**
 * Enumerate all token IDs owned by an address via ERC-721 Enumerable.
 * Requires the contract to implement `tokenOfOwnerByIndex`.
 *
 * Uses wagmi's multicall (useReadContracts) to batch all index reads
 * into a single RPC round-trip.
 */
export function useTokensOfOwner(address?: `0x${string}`) {
  const balanceQuery = useNftBalance(address)
  const count = balanceQuery.data !== undefined ? Number(balanceQuery.data) : 0

  const contractsQuery = useReadContracts({
    contracts:
      address && hasNftContract && count > 0
        ? Array.from({ length: Math.min(count, 50) }, (_, i) => ({
            address: CINA_NFT_CONTRACT,
            abi: ENUM_ABI,
            functionName: "tokenOfOwnerByIndex" as const,
            args: [address, BigInt(i)] as const,
          }))
        : [],
    query: {
      enabled: !!address && balanceQuery.isSuccess && count > 0,
    },
  })

  const tokenIds = (contractsQuery.data ?? [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => (r.result as bigint).toString())

  const isTruncated = count > tokenIds.length

  return {
    tokenIds,
    count,
    isTruncated,
    isLoading: balanceQuery.isLoading || contractsQuery.isLoading,
    isError: balanceQuery.isError || contractsQuery.isError,
  }
}
