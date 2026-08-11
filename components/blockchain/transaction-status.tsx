import { HTMLAttributes } from "react"
import { BaseError } from "viem"

import { cn } from "@/lib/utils"

import { BlockExplorerLink } from "./block-explorer-link"

interface TransactionStatusProps extends HTMLAttributes<HTMLDivElement> {
  error?: BaseError
  isError: boolean
  isLoadingTx: boolean
  isSuccess: boolean
  hash?: `0x${string}`
}

export const TransactionStatus = ({
  className,
  error,
  isError,
  isLoadingTx,
  isSuccess,
  hash,
  ...props
}: TransactionStatusProps) => {
  return (
    <>
      <div
        {...props}
        className={cn("flex items-center justify-between", className)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {(isLoadingTx || isSuccess) && (
          <>
            {isLoadingTx ? "Processing transaction..." : "Success!"}
            <BlockExplorerLink showExplorerName address={hash} type="tx" />
          </>
        )}
      </div>
      {isError && (
        <div className="break-words font-medium text-red-500" role="alert">
          Error: {error?.shortMessage ?? "Transaction failed."}
        </div>
      )}
    </>
  )
}
