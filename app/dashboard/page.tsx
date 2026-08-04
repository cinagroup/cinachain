"use client"

import Link from "next/link"
import { useAccount, useBalance, useEnsName } from "wagmi"
import { Loader2 } from "lucide-react"

import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { PWAInstallPrompt } from "@/components/pwa/install-prompt"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { useTierProgress } from "@/lib/hooks/use-tier-progress"
import { trimFormattedBalance } from "@/lib/utils"
import type { Address } from "viem"

function StatCard({
  label,
  value,
  sublabel,
  isLoading,
}: {
  label: string
  value: string
  sublabel?: string
  isLoading?: boolean
}) {
  return (
    <Card className="shadow-vercel-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-2xl text-foreground">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            value
          )}
        </div>
        {sublabel && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

function TierProgressCard({ address }: { address?: Address }) {
  const { data, isLoading, isError } = useTierProgress(address)
  const TIER_LABEL: Record<string, string> = {
    free: "Free", bronze: "Bronze", silver: "Silver",
    gold: "Gold", diamond: "Diamond", whale: "Whale",
  }
  const spendCredits = data
    ? (Number(data.cumulativeSpend) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0"
  return (
    <Card className="shadow-vercel-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Membership Tier
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-xs text-muted-foreground">Tier data unavailable</p>
        ) : isLoading || !data ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl text-foreground">
                {TIER_LABEL[data.tier] ?? data.tier}
              </span>
              <span className="text-xs text-muted-foreground">
                {spendCredits} credit spent
              </span>
            </div>
            {data.nextTier ? (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7928ca] to-[#0070f3]"
                    style={{ width: `${data.progressBps / 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {((Number(data.nextThreshold ?? 0) - Number(data.cumulativeSpend)) / 1e18).toLocaleString()} credit to{" "}
                  {TIER_LABEL[data.nextTier] ?? data.nextTier}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Top tier reached</p>
            )}
            {data.pendingBadges.length > 0 && (
              <p className="mt-2 text-xs font-medium text-violet">
                🎖 Badge pending: {data.pendingBadges.join(", ")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function PageDashboard() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading: nftLoading } = useNftBalance(address)
  const { data: balance, isLoading: balanceLoading } = useBalance({ address })
  const { data: whitelistData, isLoading: whitelistLoading } = useWhitelist(address)
  const { mintedCount, maxCount } = useContractStats()

  const balanceStr = balance
    ? trimFormattedBalance(balance.formatted, 4)
    : "0"

  const whitelistStatus = whitelistLoading
    ? null
    : whitelistData?.eligible
      ? whitelistData.phase === "whitelist"
        ? { text: "Eligible", sub: "Whitelist mint active" }
        : { text: "Public", sub: "Public mint active" }
      : whitelistData?.phase === "whitelist"
        ? { text: "Not Listed", sub: "Check back later" }
        : { text: "Public", sub: "Public mint active" }

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="ETH Balance"
              value={`${balanceStr} ETH`}
              isLoading={balanceLoading}
            />
            <StatCard
              label="NFTs Owned"
              value={nftBalance?.toString() || "0"}
              sublabel="CinaChain NFTs"
              isLoading={nftLoading}
            />
            <StatCard
              label="Whitelist"
              value={whitelistStatus?.text ?? "..."}
              sublabel={whitelistStatus?.sub}
              isLoading={whitelistLoading}
            />
            <StatCard
              label="Collection Progress"
              value={`${mintedCount.toLocaleString()} / ${maxCount.toLocaleString()}`}
              sublabel="Total minted"
            />
          </div>

          {/* Membership Tier */}
          <div className="mt-8">
            <TierProgressCard address={address} />
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

          {/* PWA Install */}
          <div className="mt-8">
            <PWAInstallPrompt />
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
