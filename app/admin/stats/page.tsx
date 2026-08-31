"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { MINT_PRICE_ETH } from "@/lib/contracts/addresses"
import { hasNftContract } from "@/lib/contracts/addresses"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function StatsPage() {
  const { t } = useI18n()
  const { mintedCount, maxCount, mintPrice, isLoading } = useContractStats()

  const price = mintPrice.data ? Number(mintPrice.data) / 1e18 : MINT_PRICE_ETH
  // Note: this is an estimate. Actual revenue should be computed from Mint events.
  // Whitelist mints are free, so this overstates revenue if any whitelist mints occurred.
  const revenue = mintedCount * price
  const progress = maxCount > 0 ? (mintedCount / maxCount) * 100 : 0
  const remaining = Math.max(0, maxCount - mintedCount)

  if (!hasNftContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("admin.nftContractNotConfiguredShort")}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          {t("admin.title")}
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          {t("admin.mintingStatistics")}<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
          {t("admin.mintingStatisticsDescription")}
        </p>

        {/* Stats Grid */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.totalMinted")}
              </CardTitle>
              <Package className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {isLoading ? "..." : mintedCount.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.ofTotalSupply", {
                  count: maxCount.toLocaleString(),
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.mintPrice")}
              </CardTitle>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {price} ETH
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.perNft")}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.estimatedRevenue")}
              </CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {revenue.toFixed(2)} ETH
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.publicMintEstimate")}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.progress")}
              </CardTitle>
              <BarChart3 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {progress.toFixed(1)}%
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("admin.collectionCompleted")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle>{t("admin.mintingProgress")}</CardTitle>
            <CardDescription>
              {t("admin.progressDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("admin.progress")}
                </span>
                <span className="font-medium">
                  {mintedCount.toLocaleString()} / {maxCount.toLocaleString()}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-link transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {mintedCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.mintedCount")}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {remaining.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.remaining")}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {progress.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.complete")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
