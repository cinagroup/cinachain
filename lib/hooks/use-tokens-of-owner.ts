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

const PAGE_SIZE = 50

/**
 * Enumerate token IDs owned by an address via ERC-721 Enumerable,
 * paged 50 at a time. Each page is a single multicall (one RPC round-trip).
 * `hasMore` tells callers another page is available via `loadMore`.
 */
export function useTokensOfOwner(
  address?: `0x${string}`,
  offset = 0,
  limit = PAGE_SIZE
) {
  const balanceQuery = useNftBalance(address)
  const count = balanceQuery.data !== undefined ? Number(balanceQuery.data) : 0

  const contractsQuery = useReadContracts({
    contracts:
      address && hasNftContract && count > offset
        ? Array.from({ length: Math.min(limit, count - offset) }, (_, i) => ({
            address: CINA_NFT_CONTRACT,
            abi: ENUM_ABI,
            functionName: "tokenOfOwnerByIndex" as const,
            args: [address, BigInt(offset + i)] as const,
          }))
        : [],
    query: {
      enabled: !!address && balanceQuery.isSuccess && count > offset,
      placeholderData: undefined,
    },
  })

  const tokenIds = (contractsQuery.data ?? [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => (r.result as bigint).toString())

  const hasMore = count > offset + tokenIds.length

  return {
    tokenIds,
    count,
    hasMore,
    isLoading: balanceQuery.isLoading || contractsQuery.isLoading,
    isError: balanceQuery.isError || contractsQuery.isError,
  }
}

export { PAGE_SIZE as OWNED_PAGE_SIZE }
