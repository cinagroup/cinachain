"use client"

import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://cinachain-billing.cinagroup.workers.dev"

export interface TierProgress {
  address: string
  tier: string
  cumulativeSpend: string
  nextTier: string | null
  nextThreshold: string | null
  progressBps: number
  pendingBadges: string[]
  mintedBadges: string[]
}

export function useTierProgress(address?: Address) {
  return useQuery({
    queryKey: ["tier", address],
    queryFn: async (): Promise<TierProgress> => {
      const res = await fetch(`${BILLING_API_URL}/v1/tier/${address}`)
      if (!res.ok) throw new Error(`tier lookup failed: ${res.status}`)
      return res.json()
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}
