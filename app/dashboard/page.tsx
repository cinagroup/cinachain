"use client"

import Link from "next/link"

import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletBalance } from "@/components/blockchain/wallet-balance"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { SignInButton } from "@/components/blockchain/sign-in-button"

export default function PageDashboard() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading: nftLoading } = useNftBalance(address)

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <IsWalletConnected>
          {/* Header */}
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Welcome back, <WalletEnsName /><span className="text-foreground">.</span>
            </h1>
            <WalletAddress className="mt-2 block font-mono-tech text-sm text-muted-foreground" />
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-vercel-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  ETH Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl text-foreground">
                  <WalletBalance decimals={4} /> ETH
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-vercel-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  NFTs Owned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl text-foreground">
                  {nftLoading ? "..." : nftBalance?.toString() || "0"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">CinaChain NFTs</p>
              </CardContent>
            </Card>

            <Card className="shadow-vercel-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Whitelist Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl text-foreground">-</div>
                <p className="mt-1 text-xs text-muted-foreground">Check mint page</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="font-display text-lg text-foreground mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="flex-1">
                <Link href="/mint">Mint NFT</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href="/explore">Explore Collection</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href="/dashboard/nfts">View My NFTs</Link>
              </Button>
            </div>
          </div>
        </IsWalletConnected>

        <IsWalletDisconnected>
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Authentication Required
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
              Connect your wallet<span className="text-foreground">.</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-md">
              Connect your wallet to view your personalized dashboard, manage your NFTs, and access exclusive features.
            </p>
            <div className="mt-8">
              <SignInButton />
            </div>
          </div>
        </IsWalletDisconnected>
      </div>
    </div>
  )
}
