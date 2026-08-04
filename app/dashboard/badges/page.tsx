"use client"

import { useAccount } from "wagmi"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { useUserBadges } from "@/lib/hooks/use-badges"
import { hasErc1155Contract } from "@/lib/contracts/addresses"
import { Award, Lock } from "lucide-react"

export default function BadgesPage() {
  return (
    <div className="min-h-screen bg-background">
      <IsWalletConnected>
        <BadgesContent />
      </IsWalletConnected>
      <IsWalletDisconnected>
        <div className="flex h-[60vh] flex-col items-center justify-center text-center">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Authentication Required
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
            Connect your wallet<span className="text-foreground">.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Connect your wallet to view your CinaChain badges and achievements.
          </p>
          <div className="mt-8">
            <SignInButton />
          </div>
        </div>
      </IsWalletDisconnected>
    </div>
  )
}

function BadgesContent() {
  const { address } = useAccount()
  const { badges, ownedBadges, ownedCount, isLoading } = useUserBadges(address)

  if (!hasErc1155Contract) {
    return (
      <div>
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Dashboard
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Badges<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Collect achievements and unlock special privileges.
          </p>
        </div>
        <Card className="shadow-vercel-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lock className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-base text-muted-foreground">
              Badge contract not configured.
            </p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Set NEXT_PUBLIC_CINA_ERC1155_CONTRACT to enable badges.
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
            Dashboard
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Badges<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Collect achievements and unlock special privileges.
          </p>
        </div>
        {ownedCount > 0 && (
          <div className="rounded-md border border-border bg-card px-4 py-2 shadow-vercel-sm">
            <span className="text-xs text-muted-foreground">Earned</span>
            <p className="font-display text-lg text-foreground">{ownedCount}</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {ownedCount > 0 && (
        <Card className="mb-6 shadow-vercel-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="size-5 text-[#0070f3]" />
              <p className="text-sm text-foreground">
                You&apos;ve earned{" "}
                <span className="font-semibold">{ownedCount}</span> badge
                {ownedCount > 1 ? "s" : ""}. Keep minting and collecting to
                unlock more!
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
                ? "border-[#0070f3]/30 bg-card shadow-vercel-card"
                : "border-border bg-secondary/50 opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex size-12 items-center justify-center rounded-lg text-2xl ${
                  badge.owned ? "bg-[#0070f3]/10" : "bg-secondary grayscale"
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
                    <span className="rounded-full bg-[#50e3c2]/20 px-2 py-0.5 text-[10px] font-semibold text-[#29bc9b]">
                      Owned
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
          Loading badges...
        </p>
      )}

      {!isLoading && ownedCount === 0 && (
        <div className="mt-8 rounded-lg border border-border bg-card p-8 text-center shadow-vercel-card">
          <Award className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-4 text-base text-muted-foreground">
            No badges earned yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Mint NFTs and participate in the community to earn badges!
          </p>
        </div>
      )}
    </div>
  )
}
