export type ChainReadStatus =
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "stale"

interface ChainReadStateInput {
  isConfigured: boolean
  isPending: boolean
  hasData: boolean
  hasError: boolean
  isRefetchError: boolean
  isEmpty: boolean
}

/**
 * Maps query-library flags to the product-level states used by chain reads.
 * `stale` is intentionally limited to a failed refresh with complete cached
 * data; an incomplete multicall is an error, never an empty result.
 */
export function getChainReadStatus({
  isConfigured,
  isPending,
  hasData,
  hasError,
  isRefetchError,
  isEmpty,
}: ChainReadStateInput): ChainReadStatus {
  if (!isConfigured) return "error"
  if (isPending && !hasData) return "loading"
  if (isRefetchError && hasData) return "stale"
  if (hasError || !hasData) return "error"
  if (isEmpty) return "empty"
  return "success"
}
