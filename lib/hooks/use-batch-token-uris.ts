"use client"

import { useMemo } from "react"
import { useReadContracts } from "wagmi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"

/**
 * Reads tokenURI for a list of token IDs in ONE multicall
 * (useReadContracts -> Multicall3 aggregate3, a single eth_call).
 * Returns a Map<tokenId-string, uri>. Ids whose call failed (unminted,
 * revert) are absent — callers pass undefined and the card falls back
 * to its individual useTokenMetadata read.
 */
export function useBatchTokenUris(tokenIds: string[]) {
  const contracts = useMemo(
    () =>
      tokenIds.map((tokenId) => ({
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      })),
    [tokenIds]
  )

  const { data, isPending } = useReadContracts({
    contracts,
    query: {
      enabled: hasNftContract && tokenIds.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  })

  return useMemo(() => {
    const uriByTokenId = new Map<string, string>()
    data?.forEach((entry, index) => {
      if (entry.status === "success" && typeof entry.result === "string") {
        uriByTokenId.set(tokenIds[index], entry.result)
      }
    })
    return { uriByTokenId, isPending }
  }, [data, tokenIds, isPending])
}
