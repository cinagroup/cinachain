"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, PackageOpen } from "lucide-react"
import { useAccount } from "wagmi"

import { useBatchTokenUris } from "@/lib/hooks/use-batch-token-uris"
import {
  OWNED_PAGE_SIZE,
  useTokensOfOwner,
} from "@/lib/hooks/use-tokens-of-owner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NftCard, NftCardSkeleton } from "@/components/nft/nft-card"
import { ChainReadNotice } from "@/components/shared/chain-read-notice"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

export default function MyNftsPage() {
  const { address } = useAccount()

  // Paged enumeration — "Load more" appends the next 50 tokens
  const [offset, setOffset] = useState(0)
  const { tokenIds, count, hasMore, status, isRetrying, refetch } =
    useTokensOfOwner(address, offset)

  // ONE multicall for all tokenURI reads of the current page
  const { uriByTokenId, isPending: batchLoading } = useBatchTokenUris(tokenIds)

  const metadataLoading = tokenIds.length > 0 && batchLoading
  const isLoading = status === "loading" || metadataLoading
  const showGrid =
    !metadataLoading &&
    (status === "success" || status === "stale") &&
    tokenIds.length > 0

  return (
    <div className="min-h-screen bg-background">
      <IsWalletConnected>
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Dashboard
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            My NFTs<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Your CinaChain NFT collection.
          </p>
        </div>

        {/* Summary */}
        <Card className="mb-6 shadow-vercel-card">
          <CardHeader>
            <CardTitle>Collection summary</CardTitle>
            <CardDescription>Total NFTs owned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl">
              {status === "loading"
                ? "..."
                : status === "error"
                ? "Unavailable"
                : count.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {status === "error" && (
          <div className="mb-6">
            <ChainReadNotice
              description="We could not read this wallet's NFT balance or ownership data. An empty collection is not being inferred."
              isRetrying={isRetrying}
              onRetry={() => void refetch()}
              state="error"
              title="NFT ownership data unavailable"
            />
          </div>
        )}

        {status === "stale" && (
          <div className="mb-6">
            <ChainReadNotice
              description="The latest refresh failed. The balance and NFTs below are from the last complete on-chain response."
              isRetrying={isRetrying}
              onRetry={() => void refetch()}
              state="stale"
              title="Showing last known ownership data"
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Owned NFTs grid */}
        {showGrid && (
          <div>
            <h2 className="font-display mb-4 text-xl">Your NFTs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tokenIds.map((tokenId) => (
                <NftCard
                  key={tokenId}
                  tokenId={tokenId}
                  preloadedTokenURI={uriByTokenId.get(tokenId)}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={() => setOffset((o) => o + OWNED_PAGE_SIZE)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Load more ({count - offset - tokenIds.length} more)
                </Button>
              )}
              {!hasMore && (
                <p className="text-sm text-muted-foreground">
                  Showing {Math.min(offset + tokenIds.length, count)} of {count}{" "}
                  owned NFTs.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty is shown only after a complete, successful ownership read. */}
        {status === "empty" && (
          <div className="rounded-lg border border-border bg-card p-12 text-center shadow-vercel-card">
            <PackageOpen className="mx-auto size-12 text-muted-foreground/40" />
            <p className="mt-4 text-base text-muted-foreground">
              You don&apos;t own any CinaChain NFTs yet.
            </p>
            <Button asChild className="mt-4">
              <Link href="/mint">Mint your first NFT</Link>
            </Button>
          </div>
        )}
      </IsWalletConnected>

      <IsWalletDisconnected>
        <div className="py-12 text-center">
          <h2 className="font-display mb-2 text-xl">Connect your wallet</h2>
          <p className="text-muted-foreground">
            Connect your wallet to view your NFT collection.
          </p>
        </div>
      </IsWalletDisconnected>
    </div>
  )
}
