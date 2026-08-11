"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"

import { hasNftContract } from "@/lib/contracts/addresses"
import { useTokenMetadata } from "@/lib/hooks/use-token-metadata"
import CinaNftImage from "@/components/CinaNftImage"
import { FavoriteButton } from "@/components/favorites/favorite-button"

interface NftCardProps {
  tokenId: string
  showFavorite?: boolean
  /** URI from the explore-page multicall; skips the per-card tokenURI RPC read */
  preloadedTokenURI?: string | null
}

/**
 * NFT card with real metadata loading via useTokenMetadata.
 * Displays image, name, tokenId, and price.
 * Includes favorite toggle.
 */
export function NftCard({
  tokenId,
  showFavorite = true,
  preloadedTokenURI,
}: NftCardProps) {
  const { metadata, image, name, isLoading } = useTokenMetadata(
    tokenId,
    preloadedTokenURI
  )

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-vercel-card transition-all hover:-translate-y-0.5 hover:shadow-vercel-md">
      <Link
        href={`/collection/${tokenId}`}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="relative aspect-square bg-secondary">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground/40" />
            </div>
          )}

          {!isLoading && image && (
            <CinaNftImage ipfsCidUrl={image} alt={name || `NFT #${tokenId}`} />
          )}

          {!isLoading && !image && (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-4xl text-muted-foreground/30">
                #{tokenId}
              </span>
            </div>
          )}

          {/* ERC-721 badge */}
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
              ERC-721
            </span>
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {name || `#${tokenId}`}
            </span>
          </div>
          {metadata?.attributes && metadata.attributes.length > 0 && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {metadata.attributes
                .slice(0, 2)
                .map((a) => `${a.trait_type}: ${a.value}`)
                .join(" · ")}
            </p>
          )}
        </div>
      </Link>

      {showFavorite && !isLoading && hasNftContract && (
        <div className="absolute right-2 top-2 z-10 rounded-md bg-background/80 backdrop-blur-sm">
          <FavoriteButton
            className="size-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            tokenId={tokenId}
            size="sm"
          />
        </div>
      )}
    </div>
  )
}

/** Skeleton card for loading states */
export function NftCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-vercel-card">
      <div className="aspect-square animate-pulse bg-secondary" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  )
}
