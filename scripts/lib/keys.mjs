// Shared private-key normalization for deploy/admin scripts.
// Tolerates common secret-storage quirks (leading/trailing whitespace,
// surrounding quotes, missing 0x prefix) without ever logging the value.
export function normalizePrivateKey(raw) {
  const k = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim()
  if (/^[0-9a-fA-F]{64}$/.test(k)) return "0x" + k
  return k
}

export function requirePrivateKey(envValue, label = "DEPLOY_PRIVATE_KEY") {
  const pk = normalizePrivateKey(envValue)
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error(`${label} invalid — expected 0x + 64 hex chars (quotes/whitespace trimmed, 0x auto-added)`)
  }
  return pk
}
