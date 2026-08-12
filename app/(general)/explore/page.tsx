"use client"

import { useMemo } from "react"
import { PackageOpen } from "lucide-react"

import { hasNftContract } from "@/lib/contracts/addresses"
import { useBatchTokenUris } from "@/lib/hooks/use-batch-token-uris"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { NftCard, NftCardSkeleton } from "@/components/nft/nft-card"
import { ChainReadNotice } from "@/components/shared/chain-read-notice"

const PAGE_SIZE = 24

export default function ExplorePage() {
  const { data: stats, status, isRetrying, refetch } = useContractStats()

  // Show token IDs from 1 to mintedCount (capped at 100 for performance)
  const tokenIds = useMemo(() => {
    const limit = Math.min(stats?.mintedCount ?? 0, 100)
    return Array.from({ length: limit }, (_, i) => String(i + 1))
  }, [stats?.mintedCount])

  // ONE multicall for all tokenURI reads (instead of one eth_call per card)
  const { uriByTokenId, isPending: batchLoading } = useBatchTokenUris(tokenIds)

  return (
    <div className="min-h-screen bg-background">
      {/* Eyebrow */}
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Collection
      </span>

      {/* Heading */}
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        CinaChain NFT gallery<span className="text-foreground">.</span>
      </h1>

      <p className="mt-3 max-w-[560px] text-base leading-7 text-muted-foreground">
        Browse the full collection. Each NFT is stored on IPFS with
        multi-gateway fallback.
      </p>

      {/* Stats Bar */}
      {stats && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="rounded-md border border-border bg-card px-4 py-2 shadow-vercel-sm">
            <span className="text-xs text-muted-foreground">Total minted</span>
            <p className="font-display text-lg text-foreground">
              {stats.mintedCount.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Contract not configured */}
      {!hasNftContract && (
        <div className="mt-12 rounded-lg border border-border bg-card p-12 text-center shadow-vercel-card">
          <p className="text-base text-muted-foreground">
            NFT contract not configured. Set NEXT_PUBLIC_CINA_NFT_CONTRACT to
            view the collection.
          </p>
        </div>
      )}

      {/* Loading state */}
      {hasNftContract && status === "loading" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Read errors are distinct from a successfully empty collection. */}
      {hasNftContract && status === "error" && (
        <div className="mt-8">
          <ChainReadNotice
            description="We could not read the collection from Base Sepolia. No NFT count or empty state is being inferred."
            isRetrying={isRetrying}
            onRetry={() => void refetch()}
            state="error"
            title="Collection data unavailable"
          />
        </div>
      )}

      {hasNftContract && status === "stale" && (
        <div className="mt-8">
          <ChainReadNotice
            description="The latest refresh failed. The gallery below uses the last complete on-chain response."
            isRetrying={isRetrying}
            onRetry={() => void refetch()}
            state="stale"
            title="Showing last known data"
          />
        </div>
      )}

      {/* Empty state */}
      {hasNftContract && status === "empty" && (
        <div className="mt-12 rounded-lg border border-border bg-card p-12 text-center shadow-vercel-card">
          <PackageOpen className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-4 text-base text-muted-foreground">
            No NFTs minted yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Be the first to mint a CinaChain NFT!
          </p>
        </div>
      )}

      {/* NFT Grid — gate on the batch multicall so cards don't fire
          individual RPC reads while it's in flight */}
      {hasNftContract &&
        (status === "success" || status === "stale") &&
        tokenIds.length > 0 && (
          <>
            {batchLoading ? (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tokenIds.map((tokenId) => (
                  <NftCard
                    key={tokenId}
                    tokenId={tokenId}
                    preloadedTokenURI={uriByTokenId.get(tokenId)}
                  />
                ))}
              </div>
            )}

            {stats && stats.mintedCount > 100 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Showing first 100 of {stats.mintedCount.toLocaleString()} minted
                NFTs.
              </p>
            )}
          </>
        )}
    </div>
  )
}
