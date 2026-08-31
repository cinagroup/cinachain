"use client"

import { useAccount } from "wagmi"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { useI18n } from "@/lib/i18n"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { useUserBadges } from "@/lib/hooks/use-badges"
import { hasErc1155Contract } from "@/lib/contracts/addresses"
import { Award, Lock } from "lucide-react"

export default function BadgesPage() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-background">
      <IsWalletConnected>
        <BadgesContent />
      </IsWalletConnected>
      <IsWalletDisconnected>
        <div className="flex h-[60vh] flex-col items-center justify-center text-center">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            {t("auth.required")}
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
            {t("badges.connectWallet")}<span className="text-foreground">.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            {t("badges.connectToView")}
          </p>
          <div className="mt-8">
            <WalletConnect />
          </div>
        </div>
      </IsWalletDisconnected>
    </div>
  )
}

function BadgesContent() {
  const { t } = useI18n()
  const { address } = useAccount()
  const { badges, ownedBadges, ownedCount, isLoading } = useUserBadges(address)

  if (!hasErc1155Contract) {
    return (
      <div>
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            {t("nav.dashboard")}
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            {t("badges.title")}<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            {t("badges.description")}
          </p>
        </div>
        <Card className="shadow-vercel-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lock className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-base text-muted-foreground">
              {t("badges.contractNotConfigured")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              {t("badges.configureContract")}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            {t("nav.dashboard")}
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            {t("badges.title")}<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            {t("badges.description")}
          </p>
        </div>
        {ownedCount > 0 && (
          <div className="rounded-md border border-border bg-card px-4 py-2 shadow-vercel-sm">
            <span className="text-xs text-muted-foreground">
              {t("badges.earned")}
            </span>
            <p className="font-display text-lg text-foreground">{ownedCount}</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {ownedCount > 0 && (
        <Card className="mb-6 shadow-vercel-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="size-5 text-link" />
              <p className="text-sm text-foreground">
                {t("badges.earnedSummary", { count: ownedCount })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badge Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`rounded-lg border p-5 transition-all ${
              badge.owned
                ? "border-link/30 bg-card shadow-vercel-card"
                : "border-border bg-secondary/50 opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex size-12 items-center justify-center rounded-lg text-2xl ${
                  badge.owned ? "bg-link/10" : "bg-secondary grayscale"
                }`}
              >
                {badge.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {badge.name}
                  </h3>
                  {badge.owned && (
                    <span className="bg-cyan/20 rounded-full px-2 py-0.5 text-[10px] font-semibold text-cyan-deep">
                      {t("badges.owned")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {badge.description}
                </p>
                {badge.owned && badge.balance > 1 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ×{badge.balance}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("badges.loading")}
        </p>
      )}

      {!isLoading && ownedCount === 0 && (
        <div className="mt-8 rounded-lg border border-border bg-card p-8 text-center shadow-vercel-card">
          <Award className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-4 text-base text-muted-foreground">
            {t("badges.noBadges")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            {t("badges.emptyDescription")}
          </p>
        </div>
      )}
    </div>
  )
}
