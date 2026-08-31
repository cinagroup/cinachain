// Address ownership proof for API-key binding (billing worker).
//
// The client signs a SIWE-style message with its wallet; this module
// verifies the signature without any RPC dependency for EOA accounts:
//   - EOA: EIP-191 personal_sign → recover address via secp256k1 ecrecover
//   - Smart account (EIP-1271): eth_call isValidSignature on the account
//   - Counterfactual (EIP-6492) smart accounts cannot be verified without
//     deployment simulation — the caller is told to deploy the account first
//
// Nonce replay protection: callers must persist used message hashes (KV).
import { secp256k1 } from "@noble/curves/secp256k1.js"
import { keccak_256 } from "@noble/hashes/sha3.js"
import { utf8ToBytes } from "@noble/hashes/utils.js"

export const CHAIN_ID = 84532n // Base Sepolia

/** URI declared in binding messages — must match the worker's public host. */
export const BINDING_URI = "https://billing-api.cinachain.com"

/** SIWE-style message the client must sign. */
export function buildBindingMessage(address, nonce, issuedAt, apiKeyHash) {
  return [
    "cinachain.com wants you to sign in with your Ethereum account:",
    address,
    "",
    "Bind this API key digest to the address above.",
    "",
    `URI: ${BINDING_URI}`,
    "Version: 1",
    `Chain ID: ${CHAIN_ID.toString()}`,
    "Action: bind-api-key",
    `API Key SHA-256: ${apiKeyHash}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n")
}

/**
 * Parse a binding message produced by buildBindingMessage.
 * Returns { address, nonce, issuedAt, uri, chainId } or null when any
 * required field is missing/malformed.
 */
export function parseBindingMessage(message) {
  if (typeof message !== "string") return null
  const lines = message.split("\n")
  if (lines.length < 12 || message.length > 2048) return null
  if (!lines[0].startsWith("cinachain.com wants you to sign in")) return null
  if (!message.includes("Bind this API key digest to the address above."))
    return null
  const address = lines[1]?.trim()
  const uri = /^URI: (\S+)$/m.exec(message)?.[1]
  const chainId = /^Chain ID: (\d+)$/m.exec(message)?.[1]
  const action = /^Action: (\S+)$/m.exec(message)?.[1]
  const apiKeyHash = /^API Key SHA-256: ([a-f0-9]{64})$/m.exec(message)?.[1]
  const nonce = /^Nonce: (\S+)$/m.exec(message)?.[1]
  const issuedAt = /^Issued At: (.+)$/m.exec(message)?.[1]
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  if (
    !uri ||
    !chainId ||
    action !== "bind-api-key" ||
    !apiKeyHash ||
    typeof nonce !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(nonce) ||
    typeof issuedAt !== "string" ||
    !issuedAt
  ) {
    return null
  }
  return { address, nonce, issuedAt, uri, chainId, action, apiKeyHash }
}

/** EIP-191 personal_sign hash of a message. */
export function personalSignHash(message) {
  const msgBytes = utf8ToBytes(message)
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  return keccak_256(new Uint8Array([...prefix, ...msgBytes]))
}

function toChecksummed(address) {
  // viem-style EIP-55 checksum so comparisons are unambiguous.
  const hex = address.toLowerCase().replace(/^0x/, "")
  const hash = Buffer.from(keccak_256(utf8ToBytes(hex))).toString("hex")
  let out = "0x"
  for (let i = 0; i < hex.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i]
  }
  return out
}

/** Recover the signer address from an EIP-191 signature (65-byte hex). */
export function recoverEOAAddress(message, signature) {
  if (typeof signature !== "string") return null
  const sig = signature.replace(/^0x/, "")
  if (!/^[0-9a-fA-F]{130}$/.test(sig)) return null
  const v = parseInt(sig.slice(128, 130), 16)
  if (v !== 27 && v !== 28) return null
  try {
    // noble-curves 2.x: Signature takes (r, s, recovery) as bigints and its
    // recoverPublicKey expects the already-hashed digest (EIP-191).
    const sigInst = new secp256k1.Signature(
      BigInt(`0x${sig.slice(0, 64)}`),
      BigInt(`0x${sig.slice(64, 128)}`),
      v - 27
    )
    const pub = sigInst
      .recoverPublicKey(personalSignHash(message))
      .toBytes(false)
    const hash = keccak_256(pub.slice(1))
    return toChecksummed(`0x${Buffer.from(hash.slice(12)).toString("hex")}`)
  } catch {
    return null
  }
}

// isValidSignature(bytes32 hash, bytes signature) → bytes4 magic 0x1626ba7e
const IS_VALID_SIG_SELECTOR = "0x1626ba7e"

export function encodeIsValidSignature(msgHashHex, signature) {
  const sig = signature.replace(/^0x/, "")
  if (!/^[0-9a-fA-F]+$/.test(sig)) return ""
  const byteLen = sig.length / 2
  // ABI: selector + bytes32 hash + offset(32) + length(32) + data (32-aligned)
  const offset = (64).toString(16).padStart(64, "0") // 0x40: hash(32)+offset(32)
  const sigLen = byteLen.toString(16).padStart(64, "0")
  const paddedLen = Math.ceil(byteLen / 32) * 64
  const sigPadded = sig.padEnd(paddedLen, "0")
  return (
    IS_VALID_SIG_SELECTOR +
    msgHashHex.replace(/^0x/, "") +
    offset +
    sigLen +
    sigPadded
  )
}

/** Verify EIP-1271 smart-account signature via eth_call. */
export async function verify1271(rpc, address, message, signature) {
  const msgHash = Buffer.from(personalSignHash(message)).toString("hex")
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: address,
          data: encodeIsValidSignature(`0x${msgHash}`, signature),
        },
        "latest",
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return false
  const j = await res.json().catch(() => null)
  const result = j?.result ?? ""
  // Magic value 0x1626ba7e (padded to 32 bytes)
  return result.toLowerCase().includes("1626ba7e")
}

/**
 * Verify an address-ownership proof. Returns { ok: true } or
 * { ok: false, error }.
 */
export async function verifyOwnership(env, { address, message, signature }) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { ok: false, error: "Invalid address" }
  }
  if (
    typeof message !== "string" ||
    (!message.includes(address.toLowerCase()) && !message.includes(address))
  ) {
    return { ok: false, error: "Message does not match address" }
  }
  if (typeof signature !== "string" || signature.length < 130) {
    return { ok: false, error: "Invalid signature" }
  }

  // 1) EOA personal_sign recovery
  const recovered = recoverEOAAddress(message, signature)
  if (recovered && recovered.toLowerCase() === address.toLowerCase()) {
    return { ok: true }
  }

  // 2) EIP-1271 smart account (eth_call isValidSignature)
  const rpc = env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  try {
    const ok1271 = await verify1271(rpc, address, message, signature)
    if (ok1271) return { ok: true }
  } catch {
    // fall through
  }

  return {
    ok: false,
    error:
      "Signature verification failed. EOA, EIP-1271 (deployed smart account) accepted; " +
      "counterfactual smart accounts must complete their first transaction first.",
  }
}
