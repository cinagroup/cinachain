"use client"

import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { useTokensOfOwner } from "@/lib/hooks/use-tokens-of-owner"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NftCard, NftCardSkeleton } from "@/components/nft/nft-card"
import { PackageOpen } from "lucide-react"
import Link from "next/link"

export default function MyNftsPage() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading: balanceLoading } = useNftBalance(address)
  const { tokenIds, count, isTruncated, isLoading: tokensLoading } = useTokensOfOwner(address)

  const isLoading = balanceLoading || tokensLoading

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
        {!isLoading && tokenIds.length > 0 && (
          <div>
            <h2 className="font-display mb-4 text-xl">Your NFTs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tokenIds.map((tokenId) => (
                <NftCard key={tokenId} tokenId={tokenId} />
              ))}
            </div>
            {isTruncated && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Showing first {tokenIds.length} of {count} owned NFTs.
              </p>
            )}
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
