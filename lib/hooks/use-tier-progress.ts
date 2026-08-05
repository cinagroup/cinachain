"use client"

import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://billing-api.cinachain.com"

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
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(`${BILLING_API_URL}/v1/tier/${address ?? ""}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`tier lookup failed: ${res.status}`)
        return (await res.json()) as TierProgress
      } catch (err) {
        clearTimeout(timeout)
        throw err
      }
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}
