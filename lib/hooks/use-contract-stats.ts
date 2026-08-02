import { useReadContract } from "wagmi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"

/**
 * Aggregate contract stats for admin/explore pages.
 * Each read is independent so partial failures don't block the UI.
 */
export function useContractStats() {
  const totalSupply = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "totalSupply",
    query: { enabled: hasNftContract },
  })

  const maxSupply = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "maxSupply",
    query: { enabled: hasNftContract },
  })

  const mintPrice = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "mintPrice",
    query: { enabled: hasNftContract },
  })

  const paused = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "paused",
    query: { enabled: hasNftContract },
  })

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
    isLoading: totalSupply.isLoading || maxSupply.isLoading,
  }
}
