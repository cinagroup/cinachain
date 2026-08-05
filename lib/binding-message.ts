/**
 * API-key binding message (client side).
 *
 * Mirrors workers/billing/src/lib/sig-verify.js `buildBindingMessage` — the
 * worker is the source of truth for verification (it re-parses and checks
 * URI/chain-id/freshness/nonce), so if the format changes, change both.
 */

export const KEY_BINDING_URI = "https://billing-api.cinachain.com"
export const KEY_BINDING_CHAIN_ID = 84532n // Base Sepolia

/** SIWE-style message the wallet signs to prove address ownership. */
export function buildBindingMessage(
  address: string,
  nonce: string,
  issuedAt: string
): string {
  return [
    "cinachain.com wants you to sign in with your Ethereum account:",
    address,
    "",
    "Bind this API key to the address above.",
    "",
    `URI: ${KEY_BINDING_URI}`,
    "Version: 1",
    `Chain ID: ${KEY_BINDING_CHAIN_ID.toString()}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n")
}

/** Cryptographically-secure nonce (32 hex chars). */
export function generateBindingNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
