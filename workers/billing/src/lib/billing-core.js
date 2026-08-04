// workers/billing/src/lib/billing-core.js
// Pure billing logic — no I/O, unit-testable.

/** usable = onchainSnapshot - committedUsage, floor at 0 */
export function computeUsable(onchainSnapshot, committedUsage) {
  const usable = onchainSnapshot - committedUsage
  return usable > 0n ? usable : 0n
}

/** Apply a metered consumption; returns updated ledger fields */
export function applyConsumption(ledger, costMicro) {
  return {
    committedUsage: (ledger.committedUsage ?? 0n) + costMicro,
    cumulativeSpend: (ledger.cumulativeSpend ?? 0n) + costMicro,
  }
}

/** Micro-credit unit: 1 credit = 1_000_000 micro-credit (per-token pricing) */
export const MICRO = 1_000_000n

/** Unit bridge: 1 micro-credit = 1e12 wei (credit = 1e18 wei = 1e6 micro) */
export const WEI_PER_MICRO = 1_000_000_000_000n

/** Convert a micro-credit cost to wei (ledger unit) */
export function costToWei(costMicro) {
  return costMicro * WEI_PER_MICRO
}

/** Convert micro-credit to whole credits (display only) */
export function microToCredit(micro) {
  return micro / MICRO
}

// Model pricing in micro-credit per token (server-configurable)
export const pricingTable = {
  demo: { perTokenMicroCredit: 2000n }, // 1000 tokens = 2 credit
}

/** Cost in micro-credit for N tokens on a model, after tier discount */
export function estimateCost(model, tokenCount, tier = "free") {
  const row = pricingTable[model]
  if (!row) throw new Error(`unknown model: ${model}`)
  const base = row.perTokenMicroCredit * BigInt(tokenCount)
  const discountBps = TIER_DISCOUNT_BPS[tier]
  if (discountBps === undefined) throw new Error(`unknown tier: ${tier}`)
  return (base * (10_000n - discountBps)) / 10_000n
}

export const TIER_DISCOUNT_BPS = {
  free: 0n,
  bronze: 500n,   // 95%
  silver: 1000n,  // 90%
  gold: 1500n,    // 85%
  diamond: 2000n, // 80%
}

export const TIER_THRESHOLDS = [
  { tier: "diamond", min: 10_000_000n },
  { tier: "gold", min: 1_000_000n },
  { tier: "silver", min: 100_000n },
  { tier: "bronze", min: 10_000n },
  { tier: "free", min: 0n },
]

export function getTier(cumulativeSpend) {
  if (cumulativeSpend < 0n) throw new Error("cumulativeSpend must be >= 0")
  return TIER_THRESHOLDS.find((t) => cumulativeSpend >= t.min).tier
}

/** 429 decision */
export function checkQuota(usableMicro, costMicro) {
  return usableMicro >= costMicro
}
