import { useReadContracts } from "wagmi"

import { getChainReadStatus } from "@/lib/chain-read-state"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"

const CONTRACT_NOT_CONFIGURED_ERROR = new Error(
  "NFT contract is not configured"
)
const INCOMPLETE_STATS_ERROR = new Error(
  "The NFT contract returned incomplete statistics"
)

interface ReadResult<T> {
  data: T | undefined
  isLoading: boolean
}

export interface ContractStatsData {
  totalSupply: bigint
  maxSupply: bigint
  mintPrice: bigint
  paused: boolean
  mintedCount: number
  maxCount: number
  remaining: number
  progress: number
}

/**
 * Aggregate contract stats for admin/explore/mint pages.
 *
 * All four reads go through ONE useReadContracts multicall (single eth_call
 * round-trip) instead of four independent useReadContract hooks. The query is
 * shared across all consumers via wagmi's default query key, and refreshes
 * every 10s so minted counts stay fresh after a mint (I2 fix).
 */
export function useContractStats() {
  const result = useReadContracts({
    contracts: [
      {
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "totalSupply",
      },
      {
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "maxSupply",
      },
      {
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "mintPrice",
      },
      { address: CINA_NFT_CONTRACT, abi: CINA_NFT_ABI, functionName: "paused" },
    ],
    query: {
      enabled: hasNftContract,
      refetchInterval: 10_000,
    },
  })

  // allowFailure is the wagmi default. Any failed member makes the snapshot
  // incomplete; it must not be represented as a zero value.
  const [totalSupplyRes, maxSupplyRes, mintPriceRes, pausedRes] =
    result.data ?? []

  const allReadsSucceeded =
    totalSupplyRes?.status === "success" &&
    maxSupplyRes?.status === "success" &&
    mintPriceRes?.status === "success" &&
    pausedRes?.status === "success" &&
    typeof totalSupplyRes.result === "bigint" &&
    typeof maxSupplyRes.result === "bigint" &&
    typeof mintPriceRes.result === "bigint" &&
    typeof pausedRes.result === "boolean"

  const failedRead = result.data?.find((read) => read.status === "failure")
  const stats: ContractStatsData | undefined = allReadsSucceeded
    ? (() => {
        const mintedCount = Number(totalSupplyRes.result)
        const maxCount = Number(maxSupplyRes.result)
        return {
          totalSupply: totalSupplyRes.result,
          maxSupply: maxSupplyRes.result,
          mintPrice: mintPriceRes.result,
          paused: pausedRes.result,
          mintedCount,
          maxCount,
          remaining: Math.max(0, maxCount - mintedCount),
          progress: maxCount > 0 ? (mintedCount / maxCount) * 100 : 0,
        }
      })()
    : undefined

  const error =
    result.error ??
    (failedRead?.status === "failure" ? failedRead.error : null) ??
    (!hasNftContract
      ? CONTRACT_NOT_CONFIGURED_ERROR
      : !result.isPending && !stats
      ? INCOMPLETE_STATS_ERROR
      : null)

  const status = getChainReadStatus({
    isConfigured: hasNftContract,
    isPending: result.isPending,
    hasData: stats !== undefined,
    hasError: error !== null,
    isRefetchError: result.isRefetchError,
    isEmpty: stats?.mintedCount === 0,
  })

  const totalSupply: ReadResult<bigint> = {
    data: stats?.totalSupply,
    isLoading: status === "loading",
  }
  const maxSupply: ReadResult<bigint> = {
    data: stats?.maxSupply,
    isLoading: status === "loading",
  }
  const mintPrice: ReadResult<bigint> = {
    data: stats?.mintPrice,
    isLoading: status === "loading",
  }
  const paused: ReadResult<boolean> = {
    data: stats?.paused,
    isLoading: status === "loading",
  }

  // Compatibility aliases for existing consumers. Read-state-aware pages use
  // `data` and `status` so these fallbacks are never shown as on-chain facts.
  const mintedCount = stats?.mintedCount ?? 0
  const maxCount = stats?.maxCount ?? 10000
  const remaining = stats?.remaining ?? maxCount
  const progress = stats?.progress ?? 0

  return {
    data: stats,
    status,
    error,
    totalSupply,
    maxSupply,
    mintPrice,
    paused,
    mintedCount,
    maxCount,
    remaining,
    progress,
    isLoading: status === "loading",
    isError: status === "error",
    isStale: status === "stale",
    isEmpty: status === "empty",
    isFetching: result.isFetching,
    isRetrying: result.isRefetching,
    refetch: result.refetch,
  }
}
