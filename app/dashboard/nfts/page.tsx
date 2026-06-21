"use client"

import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function MyNftsPage() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading } = useNftBalance(address)

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
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

        <Card className="mb-6 shadow-vercel-card">
          <CardHeader>
            <CardTitle>Collection Summary</CardTitle>
            <CardDescription>
              Total NFTs owned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display">
              {isLoading ? "..." : nftBalance?.toString() || "0"}
            </div>
          </CardContent>
        </Card>

        {nftBalance && nftBalance > BigInt(0) ? (
          <div>
            <h2 className="font-display text-xl mb-4">Your NFTs</h2>
            <p className="text-muted-foreground mb-4">
              Detailed NFT listing with images and metadata will be available in Phase 3.
              For now, you can view your NFTs on external explorers.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/explore">Explore All NFTs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`https://etherscan.io/token/${process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT}?a=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Etherscan
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              You don't own any CinaChain NFTs yet.
            </p>
            <Button asChild>
              <Link href="/mint">Mint Your First NFT</Link>
            </Button>
          </div>
        )}
      </IsWalletConnected>

      <IsWalletDisconnected>
        <div className="text-center py-12">
          <h2 className="font-display text-xl mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Connect your wallet to view your NFT collection.
          </p>
        </div>
      </IsWalletDisconnected>
      </div>
    </div>
  )
}
