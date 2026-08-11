import { HTMLAttributes } from "react"
import { type Address } from "viem"

import { EXPLORER_NAME, getBlockExplorerUrl } from "@/config/deployment"
import { cn } from "@/lib/utils"

interface BlockExplorerLinkProps extends HTMLAttributes<HTMLSpanElement> {
  address: Address | undefined
  showExplorerName?: boolean
  type?: "address" | "tx"
}

export const BlockExplorerLink = ({
  address,
  children,
  className,
  showExplorerName,
  type = "address",
  ...props
}: BlockExplorerLinkProps) => {
  if (!address) return null

  return (
    <span
      className={cn("overflow-x-auto font-medium underline", className)}
      {...props}
    >
      <a
        href={getBlockExplorerUrl(type, address)}
        rel="noreferrer"
        target="_blank"
      >
        {showExplorerName ? EXPLORER_NAME : children ?? address}
      </a>
    </span>
  )
}
