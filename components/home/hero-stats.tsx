"use client"

import { PRIMARY_NETWORK_NAME } from "@/config/deployment"
import { useContractStats } from "@/lib/hooks/use-contract-stats"

export function HeroStats() {
  const { data: stats, status } = useContractStats()
  const unavailableValue = status === "loading" ? "..." : "Unavailable"

  return (
    <dl
      aria-busy={status === "loading"}
      aria-label={
        status === "stale"
          ? "Collection statistics, last known values"
          : undefined
      }
      className="mx-auto mt-12 flex max-w-screen-sm items-center justify-center divide-x divide-border rounded-lg border border-border bg-card px-2 py-4 shadow-vercel-sm"
    >
      <HeroStat
        label="NFTs minted"
        value={stats?.mintedCount.toLocaleString() ?? unavailableValue}
      />
      <HeroStat
        label="Max supply"
        value={stats?.maxCount.toLocaleString() ?? unavailableValue}
      />
      <HeroStat label="Network" value={PRIMARY_NETWORK_NAME} />
    </dl>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-6 text-center">
      <dt className="font-mono-tech order-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-display order-1 text-xl text-foreground">{value}</dd>
    </div>
  )
}
