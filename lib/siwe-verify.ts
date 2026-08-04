import { type PublicClient } from "viem"
import { verifyMessage } from "viem/actions"

/**
 * Verify a SIWE message signature. Supports EOA (direct), EIP-1271
 * (deployed smart accounts) and EIP-6492 (counterfactual smart accounts)
 * via viem's verifyMessage — Reown smart accounts emit 1271/6492.
 *
 * NOTE: imports verifyMessage from "viem/actions" (not the top-level
 * "viem" export) — the top-level one is the EOA-only recovery utility,
 * while the actions entry is the client-based verifier that also
 * supports smart-account signatures.
 */
export async function verifySiweSignature(
  publicClient: PublicClient,
  {
    address,
    message,
    signature,
  }: { address: `0x${string}`; message: string; signature: `0x${string}` }
): Promise<boolean> {
  try {
    return await verifyMessage(publicClient, {
      address,
      message,
      signature,
    })
  } catch {
    return false
  }
}
