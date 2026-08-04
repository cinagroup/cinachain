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
  whale: 0n,      // custom contract pricing — no automatic discount (spec §5)
}

// Tier thresholds are in wei units (aligned with the ledger — cumulativeSpend
// is wei; 1 credit = 1e18 wei). Spec §5 defines thresholds as credit counts:
// bronze 10k credits, silver 100k, gold 1M, diamond 10M, whale 100M.
// ⚠ Ordering is load-bearing: must stay strictly descending — getTier's
// find() and tierProgress's idx-1 both rely on it.
export const TIER_THRESHOLDS = [
  { tier: "whale", min: 100_000_000n * 10n ** 18n }, // 1 亿 credit
  { tier: "diamond", min: 10_000_000n * 10n ** 18n }, // 1000 万 credit
  { tier: "gold", min: 1_000_000n * 10n ** 18n },     // 100 万 credit
  { tier: "silver", min: 100_000n * 10n ** 18n },     // 10 万 credit
  { tier: "bronze", min: 10_000n * 10n ** 18n },      // 1 万 credit
  { tier: "free", min: 0n },
]

// Tier -> CinaBadge token ID. CinaBadge assigns custom badge types from 100
// (nextCustomBadgeId = 100) — spec §3.2 assumed 10-14, corrected to 100-104.
export const TIER_BADGE_IDS = {
  bronze: 100n,
  silver: 101n,
  gold: 102n,
  diamond: 103n,
  whale: 104n,
}

/** Badge ID for a tier, or null when the tier has no badge (free) */
export function tierBadgeId(tier) {
  return TIER_BADGE_IDS[tier] ?? null
}

/** All tier names whose threshold has been crossed, ascending */
export function tiersEarned(cumulativeSpend) {
  return TIER_THRESHOLDS.filter((t) => t.tier !== "free" && cumulativeSpend >= t.min)
    .map((t) => t.tier)
    .reverse()
}

/**
 * Tier progress for UI: {tier, nextTier, nextMin (string wei), progressBps}.
 * progressBps = position between current floor and next threshold (0..10000).
 */
export function tierProgress(cumulativeSpend) {
  const tier = getTier(cumulativeSpend)
  const idx = TIER_THRESHOLDS.findIndex((t) => t.tier === tier)
  const current = TIER_THRESHOLDS[idx]
  const next = idx > 0 ? TIER_THRESHOLDS[idx - 1] : null
  if (!next) return { tier, nextTier: null, nextMin: null, progressBps: 10000 }
  const floor = current?.min ?? 0n
  const span = next.min - floor
  const bps = span > 0n ? Number(((cumulativeSpend - floor) * 10_000n) / span) : 10000
  return {
    tier,
    nextTier: next.tier,
    nextMin: next.min.toString(),
    progressBps: Math.min(Math.max(bps, 0), 10000),
  }
}

export function getTier(cumulativeSpend) {
  if (cumulativeSpend < 0n) throw new Error("cumulativeSpend must be >= 0")
  return TIER_THRESHOLDS.find((t) => cumulativeSpend >= t.min).tier
}

/** 429 decision */
export function checkQuota(usableMicro, costMicro) {
  return usableMicro >= costMicro
}
