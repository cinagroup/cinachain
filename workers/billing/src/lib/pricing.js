// workers/billing/src/lib/pricing.js
// Model pricing (micro-credit per token) with a KV override layer so the
// platform can adjust prices without redeploying (spec §7.2).
import { TIER_DISCOUNT_BPS } from "./billing-core.js"

/** Default pricing — values are micro-credit per token (1 credit = 1e6 micro) */
export const DEFAULT_PRICING = {
  demo: { perTokenMicroCredit: 2000n },
  "gpt-4o-mini": { perTokenMicroCredit: 100n },
  "deepseek-v3": { perTokenMicroCredit: 500n },
  hunyuan: { perTokenMicroCredit: 800n },
}

/** Merge a KV override map (string values) onto the default table */
export function applyPricingOverrides(base, overrides) {
  if (!overrides) return base
  const merged = { ...base }
  for (const [model, row] of Object.entries(overrides)) {
    if (!base[model]) throw new Error(`unknown model: ${model}`)
    const raw = row?.perTokenMicroCredit
    if (raw === undefined || raw === null) continue
    if (!/^\d+$/.test(String(raw))) throw new Error(`price must be a positive integer: ${model}`)
    const v = BigInt(raw)
    if (v <= 0n) throw new Error(`price must be a positive integer: ${model}`)
    merged[model] = { perTokenMicroCredit: v }
  }
  return merged
}

/**
 * Cost in micro-credit for N tokens on a model with the given merged table.
 * Applies the tier discount (TIER_DISCOUNT_BPS, same as billing-core's legacy
 * estimateCost): free 100%, bronze 95%, silver 90%, gold 85%, diamond 80%,
 * whale 100% (custom contract pricing, spec §5).
 */
export function estimateCostWithPricing(pricing, model, tokenCount, tier = "free") {
  const row = pricing[model]
  if (!row) throw new Error(`unknown model: ${model}`)
  const base = row.perTokenMicroCredit * BigInt(tokenCount)
  const discountBps = TIER_DISCOUNT_BPS[tier]
  if (discountBps === undefined) throw new Error(`unknown tier: ${tier}`)
  return (base * (10_000n - discountBps)) / 10_000n
}
