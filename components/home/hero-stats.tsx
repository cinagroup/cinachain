"use client"

import { useContractStats } from "@/lib/hooks/use-contract-stats"

export function HeroStats() {
  const { mintedCount, maxCount, isLoading } = useContractStats()

  if (isLoading || mintedCount <= 0) return null

  return (
    <dl className="mx-auto mt-12 flex max-w-screen-sm items-center justify-center divide-x divide-border rounded-lg border border-border bg-card px-2 py-4 shadow-vercel-sm">
      <HeroStat label="NFTs Minted" value={mintedCount.toLocaleString()} />
      <HeroStat label="Max Supply" value={maxCount.toLocaleString()} />
      <HeroStat label="Network" value="Base L2" />
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
