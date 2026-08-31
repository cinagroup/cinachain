import { useReadContract, useReadContracts } from "wagmi"

import { getChainReadStatus } from "@/lib/chain-read-state"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"

const INCOMPLETE_OWNERSHIP_ERROR = new Error(
  "The NFT contract returned incomplete ownership data"
)

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
  const pageLength = Math.max(0, Math.min(limit, count - offset))

  const contractsQuery = useReadContracts({
    contracts:
      address && hasNftContract && count > offset
        ? Array.from({ length: pageLength }, (_, i) => ({
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

  const failedRead = contractsQuery.data?.find(
    (read) => read.status === "failure"
  )
  const successfulTokenIds = (contractsQuery.data ?? [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result.toString())
  const hasCompletePage =
    pageLength === 0 ||
    (successfulTokenIds.length === pageLength && failedRead === undefined)
  const hasData = balanceQuery.data !== undefined && hasCompletePage
  const error =
    balanceQuery.error ??
    contractsQuery.error ??
    (failedRead?.status === "failure" ? failedRead.error : null) ??
    (!balanceQuery.isPending && !contractsQuery.isPending && !hasData
      ? INCOMPLETE_OWNERSHIP_ERROR
      : null)
  const status = getChainReadStatus({
    isConfigured: !!address && hasNftContract,
    isPending:
      balanceQuery.isPending || (pageLength > 0 && contractsQuery.isPending),
    hasData,
    hasError: error !== null,
    isRefetchError:
      balanceQuery.isRefetchError || contractsQuery.isRefetchError,
    isEmpty: count === 0,
  })
  const tokenIds = hasCompletePage ? successfulTokenIds : []

  const hasMore = hasData && count > offset + tokenIds.length

  const refetch = async () => {
    const requests: Array<Promise<unknown>> = [balanceQuery.refetch()]
    if (pageLength > 0) requests.push(contractsQuery.refetch())
    await Promise.all(requests)
  }

  return {
    tokenIds,
    count,
    hasMore,
    status,
    error,
    isLoading: status === "loading",
    isError: status === "error",
    isStale: status === "stale",
    isRetrying: balanceQuery.isRefetching || contractsQuery.isRefetching,
    refetch,
  }
}

export { PAGE_SIZE as OWNED_PAGE_SIZE }
