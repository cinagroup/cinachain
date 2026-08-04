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
 */
export function useTokenMetadata(tokenId: bigint | number | string | undefined) {
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
    query: { enabled: hasNftContract && id !== undefined },
  })

  const metadataQuery = useQuery<NftMetadata | null>({
    queryKey: ["nft-metadata", id?.toString(), tokenURI],
    queryFn: () => (tokenURI ? fetchNftMetadata(tokenURI) : null),
    enabled: !!tokenURI,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  // Always resolve an image: real artwork if present, else an on-chain-style
  // SVG placeholder so every token renders with visual identity (I1 fix).
  const image =
    resolveNftImage(metadataQuery.data ?? null) ??
    (id !== undefined ? getNftPlaceholderSvg(id) : null)

  return {
    tokenId: id,
    tokenURI: tokenURI ?? null,
    metadata: metadataQuery.data ?? null,
    image,
    name: metadataQuery.data?.name ?? (id ? `CinaNFT #${Number(id)}` : ""),
    description: metadataQuery.data?.description ?? "",
    attributes: metadataQuery.data?.attributes ?? [],
    isLoading: uriLoading || metadataQuery.isLoading,
    isError: uriError || metadataQuery.isError,
  }
}
