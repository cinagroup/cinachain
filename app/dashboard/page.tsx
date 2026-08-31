"use client"

import Link from "next/link"
import { useAccount, useBalance, useEnsName } from "wagmi"
import { Award, Loader2 } from "lucide-react"

import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { PWAInstallPrompt } from "@/components/pwa/install-prompt"
import { ChainReadNotice } from "@/components/shared/chain-read-notice"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { useTierProgress } from "@/lib/hooks/use-tier-progress"
import { trimFormattedBalance } from "@/lib/utils"
import { formatUnits, type Address } from "viem"
import { useI18n } from "@/lib/i18n"

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
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
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
  const { t } = useI18n()
  const { data, isLoading, isError } = useTierProgress(address)
  const TIER_LABEL: Record<string, string> = {
    free: t("tier.free"),
    bronze: t("tier.bronze"),
    silver: t("tier.silver"),
    gold: t("tier.gold"),
    diamond: t("tier.diamond"),
    whale: t("tier.whale"),
  }
  const spendCredits = data
    ? (Number(data.cumulativeSpend) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0"
  return (
    <Card className="shadow-vercel-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("dashboard.membershipTier")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="text-xs text-muted-foreground">
            {t("dashboard.tierUnavailable")}
          </p>
        ) : isLoading || !data ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl text-foreground">
                {TIER_LABEL[data.tier] ?? data.tier}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("dashboard.creditSpentValue", { value: spendCredits })}
              </span>
            </div>
            {data.nextTier ? (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${data.progressBps / 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("dashboard.creditToTier", {
                    value: (
                      (Number(data.nextThreshold ?? 0) -
                        Number(data.cumulativeSpend)) /
                      1e18
                    ).toLocaleString(),
                    tier: TIER_LABEL[data.nextTier] ?? data.nextTier,
                  })}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("dashboard.topTierReached")}
              </p>
            )}
            {data.pendingBadges.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet">
                <Award aria-hidden="true" className="size-3.5" />
                {t("dashboard.badgePending", {
                  badges: data.pendingBadges.join(", "),
                })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function PageDashboard() {
  const { t } = useI18n()
  const { address } = useAccount()
  const { data: nftBalance, isLoading: nftLoading } = useNftBalance(address)
  const { data: balance, isLoading: balanceLoading } = useBalance({ address })
  const { data: whitelistData, isLoading: whitelistLoading } = useWhitelist(address)
  const {
    data: contractStats,
    status: contractStatsStatus,
    isRetrying: isRetryingContractStats,
    refetch: refetchContractStats,
  } = useContractStats()

  const balanceStr = balance
    ? trimFormattedBalance(formatUnits(balance.value, balance.decimals), 4)
    : "0"

  const whitelistStatus = whitelistLoading
    ? null
    : whitelistData?.eligible
      ? whitelistData.phase === "whitelist"
        ? { text: t("dashboard.eligible"), sub: t("mint.whitelistActive") }
        : { text: t("dashboard.public"), sub: t("mint.publicActive") }
      : whitelistData?.phase === "whitelist"
        ? { text: t("dashboard.notListed"), sub: t("dashboard.checkBackLater") }
        : { text: t("dashboard.public"), sub: t("mint.publicActive") }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        <IsWalletConnected>
          {/* Header */}
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              {t("nav.dashboard")}
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("dashboard.welcomeBack")} <WalletEnsName /><span className="text-foreground">.</span>
            </h1>
            <WalletAddress className="font-mono-tech mt-2 block text-sm text-muted-foreground" />
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("dashboard.ethBalance")}
              value={`${balanceStr} ETH`}
              isLoading={balanceLoading}
            />
            <StatCard
              label={t("dashboard.nftsOwned")}
              value={nftBalance?.toString() || "0"}
              sublabel={t("dashboard.cinaChainNfts")}
              isLoading={nftLoading}
            />
            <StatCard
              label={t("sidebar.whitelist")}
              value={whitelistStatus?.text ?? "..."}
              sublabel={whitelistStatus?.sub}
              isLoading={whitelistLoading}
            />
            <StatCard
              label={t("dashboard.collectionProgress")}
              value={
                contractStats
                  ? `${contractStats.mintedCount.toLocaleString()} / ${contractStats.maxCount.toLocaleString()}`
                  : t("status.unavailable")
              }
              sublabel={
                contractStatsStatus === "stale"
                  ? t("dashboard.lastCompleteResponse")
                  : t("dashboard.totalMinted")
              }
              isLoading={contractStatsStatus === "loading"}
            />
          </div>

          {(contractStatsStatus === "error" ||
            contractStatsStatus === "stale") && (
            <div className="mt-6">
              <ChainReadNotice
                description={
                  contractStatsStatus === "stale"
                    ? t("dashboard.progressStaleDescription")
                    : t("dashboard.progressUnavailableDescription")
                }
                isRetrying={isRetryingContractStats}
                onRetry={() => void refetchContractStats()}
                state={contractStatsStatus}
                title={
                  contractStatsStatus === "stale"
                    ? t("dashboard.showingLastProgress")
                    : t("dashboard.progressUnavailable")
                }
              />
            </div>
          )}

          {/* Membership Tier */}
          <div className="mt-8">
            <TierProgressCard address={address} />
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="font-display mb-4 text-lg text-foreground">
              {t("dashboard.quickActions")}
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="flex-1">
                <Link href="/mint">{t("home.mintNft")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href="/explore">{t("home.exploreCollection")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link href="/dashboard/nfts">{t("dashboard.viewMyNfts")}</Link>
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
              {t("auth.required")}
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
              {t("auth.connectWalletTitle")}
              <span className="text-foreground">.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              {t("dashboard.connectDescription")}
            </p>
            <div className="mt-8">
              <WalletConnect />
            </div>
          </div>
        </IsWalletDisconnected>
      </div>
    </div>
  )
}
