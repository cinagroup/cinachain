"use client"

import Link from "next/link"
import { useAccount, useBlockNumber } from "wagmi"

import {
  EXPLORER_LINK,
  PRIMARY_CHAIN_ID,
  PRIMARY_NETWORK_LABEL,
} from "@/config/deployment"
import { cn } from "@/lib/utils"
import { GetNetworkColor } from "@/lib/utils/get-network-color"
import { Badge } from "@/components/ui/badge"

const badgeVariants: Record<ReturnType<typeof GetNetworkColor>, string> = {
  green: "bg-green-200 text-green-700",
  blue: "bg-blue-200 text-blue-700",
  red: "bg-red-200 text-red-700",
  purple: "bg-purple-200 text-purple-700",
  gray: "bg-gray-200 text-gray-700",
  yellow: "bg-yellow-200 text-yellow-700",
}

export function NetworkStatus() {
  const { address, chain } = useAccount()
  const isPrimaryNetwork = chain?.id === PRIMARY_CHAIN_ID
  // Only poll the block number while a wallet is connected — visitors on
  // marketing pages and unsupported networks should not generate primary
  // RPC traffic.
  const { data } = useBlockNumber({
    chainId: PRIMARY_CHAIN_ID,
    watch: true,
    query: {
      enabled: Boolean(address && isPrimaryNetwork),
      refetchInterval: 12_000,
    },
  })
  if (!address || !chain) return null

  const content = (
    <>
      <Badge
        className={cn(
          "font-display rounded-full py-2 text-xs uppercase leading-none tracking-wider",
          badgeVariants[GetNetworkColor(chain.name)]
        )}
      >
        {isPrimaryNetwork
          ? PRIMARY_NETWORK_LABEL
          : `${chain.name} (unsupported)`}
      </Badge>
      {isPrimaryNetwork && data !== undefined && (
        <p className="mx-2 text-xs">#{data.toString()}</p>
      )}
    </>
  )

  const className =
    "fixed bottom-6 left-6 z-10 flex min-h-11 items-center overflow-hidden rounded-full bg-muted text-muted-foreground shadow-vercel-md"

  if (!isPrimaryNetwork) {
    return (
      <div role="status" aria-live="polite" className={className}>
        {content}
      </div>
    )
  }

  return (
    <Link
      href={EXPLORER_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${PRIMARY_NETWORK_LABEL} on the block explorer`}
      className={cn(
        className,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      {content}
    </Link>
  )
}
