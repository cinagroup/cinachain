import { useReadContracts } from "wagmi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"

interface ReadResult<T> {
  data: T | undefined
  isLoading: boolean
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
      { address: CINA_NFT_CONTRACT, abi: CINA_NFT_ABI, functionName: "totalSupply" },
      { address: CINA_NFT_CONTRACT, abi: CINA_NFT_ABI, functionName: "maxSupply" },
      { address: CINA_NFT_CONTRACT, abi: CINA_NFT_ABI, functionName: "mintPrice" },
      { address: CINA_NFT_CONTRACT, abi: CINA_NFT_ABI, functionName: "paused" },
    ],
    query: {
      enabled: hasNftContract,
      refetchInterval: 10_000,
    },
  })

  // allowFailure is default — extract successful results only
  const [totalSupplyRes, maxSupplyRes, mintPriceRes, pausedRes] =
    result.data ?? []

  const ok = (r: { status?: string; result?: unknown } | undefined) =>
    r && r.status === "success" ? r.result : undefined

  const totalSupply: ReadResult<bigint> = {
    data: ok(totalSupplyRes) as bigint | undefined,
    isLoading: result.isLoading,
  }
  const maxSupply: ReadResult<bigint> = {
    data: ok(maxSupplyRes) as bigint | undefined,
    isLoading: result.isLoading,
  }
  const mintPrice: ReadResult<bigint> = {
    data: ok(mintPriceRes) as bigint | undefined,
    isLoading: result.isLoading,
  }
  const paused: ReadResult<boolean> = {
    data: ok(pausedRes) as boolean | undefined,
    isLoading: result.isLoading,
  }

  const mintedCount = totalSupply.data ? Number(totalSupply.data) : 0
  const maxCount = maxSupply.data ? Number(maxSupply.data) : 10000
  const remaining = Math.max(0, maxCount - mintedCount)
  const progress = maxCount > 0 ? (mintedCount / maxCount) * 100 : 0

  return {
    totalSupply,
    maxSupply,
    mintPrice,
    paused,
    mintedCount,
    maxCount,
    remaining,
    progress,
    isLoading: result.isLoading,
    refetch: result.refetch,
  }
}
