"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { MINT_PRICE_ETH } from "@/lib/contracts/addresses"
import { hasNftContract } from "@/lib/contracts/addresses"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function StatsPage() {
  const { mintedCount, maxCount, mintPrice, isLoading } = useContractStats()

  const price = mintPrice.data ? Number(mintPrice.data) / 1e18 : MINT_PRICE_ETH
  // Note: this is an estimate. Actual revenue should be computed from Mint events.
  // Whitelist mints are free, so this overstates revenue if any whitelist mints occurred.
  const revenue = mintedCount * price
  const progress = maxCount > 0 ? (mintedCount / maxCount) * 100 : 0
  const remaining = Math.max(0, maxCount - mintedCount)

  if (!hasNftContract) {
    return (
      <div className="container max-w-[1200px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            NFT contract address not configured.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Administration
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          Minting Statistics<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
          Detailed analytics and revenue tracking for your NFT collection.
        </p>

        {/* Stats Grid */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Minted
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {isLoading ? "..." : mintedCount.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {maxCount.toLocaleString()} total supply
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mint Price
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {price} ETH
              </div>
              <p className="mt-1 text-xs text-muted-foreground">per NFT</p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Est. Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {revenue.toFixed(2)} ETH
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                estimate (public mints only)
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Progress
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {progress.toFixed(1)}%
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                collection completed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle>Minting Progress</CardTitle>
            <CardDescription>
              Visual representation of collection completion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {mintedCount.toLocaleString()} / {maxCount.toLocaleString()}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7928ca] to-[#0070f3] transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {mintedCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Minted</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {remaining.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="font-display text-lg text-foreground">
                    {progress.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
