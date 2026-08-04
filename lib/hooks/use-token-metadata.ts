import { useQuery } from "@tanstack/react-query"
import { useReadContract } from "wagmi"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import {
  fetchNftMetadata,
  resolveNftImage,
  getNftPlaceholderSvg,
  type NftMetadata,
} from "@/lib/ipfs"

/**
 * Read tokenURI from the contract, then fetch + cache NFT metadata via IPFS.
 * Uses the robust fetchNftMetadata helper (SSRF protection, timeout, fallback gateways).
 * Falls back to a deterministic SVG placeholder when the metadata has no image.
 * @param preloadedTokenURI optional URI from a batched multicall — skips the
 *        per-card tokenURI RPC read entirely when provided.
 */
export function useTokenMetadata(
  tokenId: bigint | number | string | undefined,
  preloadedTokenURI?: string | null
) {
  const id = tokenId !== undefined ? BigInt(tokenId) : undefined

  const {
    data: tokenURI,
    isLoading: uriLoading,
    isError: uriError,
  } = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "tokenURI",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled:
        hasNftContract && id !== undefined && preloadedTokenURI === undefined,
    },
  })

  const uri = preloadedTokenURI ?? tokenURI ?? null

  const metadataQuery = useQuery<NftMetadata | null>({
    queryKey: ["nft-metadata", id?.toString(), uri],
    queryFn: () => (uri ? fetchNftMetadata(uri) : null),
    enabled: !!uri,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  // Always resolve an image: real artwork if present, else an on-chain-style
  // SVG placeholder so every token renders with visual identity (I1 fix).
  const image =
    resolveNftImage(metadataQuery.data ?? null) ??
    (id !== undefined ? getNftPlaceholderSvg(id) : null)

  return {
    tokenId: id,
    tokenURI: uri,
    metadata: metadataQuery.data ?? null,
    image,
    name: metadataQuery.data?.name ?? (id ? `CinaNFT #${Number(id)}` : ""),
    description: metadataQuery.data?.description ?? "",
    attributes: metadataQuery.data?.attributes ?? [],
    isLoading: uriLoading || metadataQuery.isLoading,
    isError: uriError || metadataQuery.isError,
  }
}
