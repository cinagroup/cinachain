// CinaMega fixed-rate exchange math (pure, unit-testable).
//
// Rate (fixed by contract): 1 cina = 1000 mcina = 1,000,000 ucina.
// Unit values: ucina = 1, mcina = 1000, cina = 1,000,000 base units.
// Conversion: toAmount = amount * units[from] / units[to] (floor).
// The remainder (dust) is burned on the source side by the contract.

export const MEGA_TYPES = [1, 2, 3] as const
export type MegaType = (typeof MEGA_TYPES)[number]

export const MEGA_UNITS: Record<number, bigint> = {
  1: 1n, // ucina
  2: 1000n, // mcina
  3: 1_000_000n, // cina
}

export const MEGA_RATE_TEXT = "1 CINA = 1,000 MCINA = 1,000,000 UCINA"

export function isValidType(t: unknown): t is MegaType {
  return typeof t === "number" && MEGA_UNITS[t] !== undefined
}

export interface ConversionResult {
  ok: boolean
  toAmount: bigint // floor-converted amount (0 when not ok)
  dust: bigint // base units burned on the source side
  error?: "same-type" | "invalid-type" | "zero-amount" | "too-small"
}

/** Convert `amount` of `fromType` into `toType` (floor; dust burned). */
export function convertAmount(from: MegaType | number, to: MegaType | number, amount: bigint): ConversionResult {
  if (amount <= 0n) return { ok: false, toAmount: 0n, dust: 0n, error: "zero-amount" }
  if (!isValidType(from) || !isValidType(to)) return { ok: false, toAmount: 0n, dust: 0n, error: "invalid-type" }
  if (from === to) return { ok: false, toAmount: 0n, dust: 0n, error: "same-type" }

  const fromUnits = MEGA_UNITS[from]
  const toUnits = MEGA_UNITS[to]
  const totalUnits = amount * fromUnits
  const toAmount = totalUnits / toUnits
  const dust = totalUnits - toAmount * toUnits
  if (toAmount === 0n) return { ok: false, toAmount: 0n, dust, error: "too-small" }
  return { ok: true, toAmount, dust }
}

/** Display labels + metadata for the three collections (mirrors BADGE_INFO). */
export const MEGA_COLLECTION_INFO: Record<number, { name: string; short: string; description: string; icon: string; color: string; units: string }> = {
  1: {
    name: "UCINA",
    short: "ucina",
    description: "The base unit. Free to mint, unlimited supply — the entry point to the Cina economy.",
    icon: "🔵",
    color: "#0ea5e9",
    units: "1 UCINA = 1 unit",
  },
  2: {
    name: "MCINA",
    short: "mcina",
    description: "The mid unit. 1 MCINA = 1,000 UCINA. Obtained only by exchanging up.",
    icon: "🟢",
    color: "#10b981",
    units: "1 MCINA = 1,000 UCINA",
  },
  3: {
    name: "CINA",
    short: "cina",
    description: "The flagship unit. 1 CINA = 1,000 MCINA = 1,000,000 UCINA. Exchange-only.",
    icon: "🟡",
    color: "#f59e0b",
    units: "1 CINA = 1,000,000 UCINA",
  },
}

export function formatAmount(amount: bigint): string {
  return amount.toLocaleString("en-US")
}
