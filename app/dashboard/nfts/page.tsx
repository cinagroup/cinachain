"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { useTokensOfOwner, OWNED_PAGE_SIZE } from "@/lib/hooks/use-tokens-of-owner"
import { useBatchTokenUris } from "@/lib/hooks/use-batch-token-uris"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NftCard, NftCardSkeleton } from "@/components/nft/nft-card"
import { PackageOpen, Loader2 } from "lucide-react"
import Link from "next/link"

export default function MyNftsPage() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading: balanceLoading } = useNftBalance(address)

  // Paged enumeration — "Load more" appends the next 50 tokens
  const [offset, setOffset] = useState(0)
  const { tokenIds, count, hasMore, isLoading: tokensLoading } = useTokensOfOwner(
    address,
    offset
  )

  // ONE multicall for all tokenURI reads of the current page
  const { uriByTokenId, isPending: batchLoading } = useBatchTokenUris(tokenIds)

  const isLoading = balanceLoading || tokensLoading || batchLoading
  const showGrid = !isLoading && tokenIds.length > 0

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
          <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
            Your CinaChain NFT collection.
          </p>
        </div>

        {/* Summary */}
        <Card className="mb-6 shadow-vercel-card">
          <CardHeader>
            <CardTitle>Collection Summary</CardTitle>
            <CardDescription>Total NFTs owned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-display text-4xl">
              {balanceLoading ? "..." : nftBalance?.toString() || "0"}
            </div>
          </CardContent>
        </Card>

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
                  disabled={tokensLoading}
                >
                  {tokensLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Load More ({count - offset - tokenIds.length} more)
                </Button>
              )}
              {!hasMore && (
                <p className="text-sm text-muted-foreground">
                  Showing {Math.min(offset + tokenIds.length, count)} of {count} owned NFTs.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state — also catches enumeration failure */}
        {!isLoading && tokenIds.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-12 text-center shadow-vercel-card">
            <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-base text-muted-foreground">
              You don&apos;t own any CinaChain NFTs yet.
            </p>
            <Button asChild className="mt-4">
              <Link href="/mint">Mint Your First NFT</Link>
            </Button>
          </div>
        )}
      </IsWalletConnected>

      <IsWalletDisconnected>
        <div className="py-12 text-center">
          <h2 className="font-display mb-2 text-xl">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Connect your wallet to view your NFT collection.
          </p>
        </div>
      </IsWalletDisconnected>
    </div>
  )
}
