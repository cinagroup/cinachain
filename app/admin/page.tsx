"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, Package, DollarSign, PauseCircle, PlayCircle, FileText, Settings, BarChart3, ArrowRight, Award, Coins } from "lucide-react"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { hasNftContract } from "@/lib/contracts/addresses"
import { AlertCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function AdminOverviewPage() {
  const { t } = useI18n()
  const {
    mintedCount,
    maxCount,
    mintPrice,
    paused,
    isLoading,
  } = useContractStats()

  const priceEth = mintPrice.data ? `${Number(mintPrice.data) / 1e18} ETH` : "—"

  const stats = [
    {
      title: "Total minted",
      value: isLoading ? "..." : mintedCount.toLocaleString(),
      description: "NFTs minted so far",
      icon: Package,
    },
    {
      title: "Max supply",
      value: maxCount.toLocaleString(),
      description: "Total collection size",
      icon: TrendingUp,
    },
    {
      title: "Mint price",
      value: priceEth,
      description: "Price per NFT",
      icon: DollarSign,
    },
    {
      title: "Status",
      value: paused.data === true ? "Paused" : "Active",
      description:
        paused.data === true ? "Minting is paused" : "Minting is active",
      icon: paused.data === true ? PauseCircle : PlayCircle,
    },
  ]

  if (!hasNftContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            NFT contract address not configured. Set NEXT_PUBLIC_CINA_NFT_CONTRACT in environment variables.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Administration
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Admin dashboard<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Overview of your NFT collection and minting statistics.
          </p>
        </div>

        {/* Paused alert */}
        {paused.data === true && (
          <Alert variant="destructive" className="mb-8 shadow-vercel-sm">
            <AlertDescription>
              Minting is currently paused. Users cannot mint new NFTs.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="shadow-vercel-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl text-foreground">
                    {stat.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions */}
        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle>{t("admin.quickActions")}</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <QuickAction
                href="/admin/badges"
                icon={<Award className="size-5" />}
                title={t("admin.mintBadges")}
                description="Award achievement badges to community members"
              />
              <QuickAction
                href="/admin/whitelist"
                icon={<FileText className="size-5" />}
                title={t("admin.manageWhitelist")}
                description="Upload CSV files and manage whitelist addresses"
              />
              <QuickAction
                href="/admin/stats"
                icon={<BarChart3 className="size-5" />}
                title={t("admin.viewStats")}
                description="Detailed minting analytics and revenue tracking"
              />
              <QuickAction
                href="/admin/contract"
                icon={<Settings className="size-5" />}
                title={t("admin.contractSettings")}
                description="Pause, update prices, withdraw funds"
              />
              <QuickAction
                href="/admin/billing"
                icon={<Coins className="size-5" />}
                title={t("admin.billingSettings")}
                description="Exchange rate, credit issuance, ledger"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-vercel-md"
    >
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs text-link">
        Open
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
