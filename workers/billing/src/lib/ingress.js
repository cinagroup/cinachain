// workers/billing/src/lib/ingress.js
// Key ingress channel (spec §6.3): user submits an API key + declared
// exchange amount; the platform pools the key, meters confirmed usage,
// and mints credit once confirmed consumption reaches the declared amount.

export const MAX_DECLARED_MICRO = 1_000_000_000_000_000n // 1e15 micro = 1e9 credit cap

/** Build a fresh pending ingress record */
export function ingressRecord({ owner, model, declaredMicro, keyHash }) {
  return {
    owner,
    model,
    declaredMicro: String(declaredMicro),
    confirmedMicro: "0",
    status: "pending", // pending -> minting -> minted | rejected
    keyHash, // SHA-256 of the raw key (never the key itself)
    createdAt: Date.now(),
  }
}

/** Validate a declared amount (micro-credit): positive integer, capped */
export function validateDeclaredMicro(raw) {
  const s = String(raw ?? "")
  if (!/^\d+$/.test(s)) throw new Error("declaredMicro must be a positive integer")
  const v = BigInt(s)
  if (v <= 0n) throw new Error("declaredMicro must be a positive integer")
  if (v > MAX_DECLARED_MICRO) throw new Error("declaredMicro too large")
  return s
}

/** State machine: allowed target states from a current state */
const TRANSITIONS = {
  pending: ["minting", "rejected"],
  minting: ["minted"],
  minted: [],
  rejected: [],
}

export function ingressStatusTransitions(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to)
}

// AES-GCM key encryption for pooled ingress keys (spec §6.3: plaintext
// never leaves the platform). INGRESS_ENC_KEY = 32-byte hex (testnet var;
// mainnet: worker secret).
export function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)))
}
export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function encryptKey(secretHex, rawKey) {
  const key = await crypto.subtle.importKey("raw", hexToBytes(secretHex), { name: "AES-GCM" }, false, ["encrypt"])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(rawKey))
  return { iv: bytesToHex(iv), cipher: bytesToHex(new Uint8Array(cipher)) }
}

export async function decryptKey(secretHex, { iv, cipher }) {
  const key = await crypto.subtle.importKey("raw", hexToBytes(secretHex), { name: "AES-GCM" }, false, ["decrypt"])
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(iv) },
    key,
    hexToBytes(cipher)
  )
  return new TextDecoder().decode(plain)
}
