import type { Address } from "viem"
import { createSiweMessage, generateSiweNonce } from "viem/siwe"

const SIWE_SESSION_DURATION_MS = 24 * 60 * 60 * 1000

interface CreateCinaChainSiweMessageParameters {
  address: Address
  chainId: number
  domain: string
  nonce?: string
  now?: Date
  uri: string
}

export interface CinaChainSiweMessage {
  expirationTime: string
  message: string
  nonce: string
}

/**
 * Creates the EIP-4361 message used by the client-side CinaChain session.
 * Keeping this pure makes the exact domain, chain, nonce and expiry contract
 * independently testable without loading React or a wallet provider.
 */
export function createCinaChainSiweMessage({
  address,
  chainId,
  domain,
  nonce = generateSiweNonce(),
  now = new Date(),
  uri,
}: CreateCinaChainSiweMessageParameters): CinaChainSiweMessage {
  const expirationTime = new Date(now.getTime() + SIWE_SESSION_DURATION_MS)

  return {
    expirationTime: expirationTime.toISOString(),
    message: createSiweMessage({
      address,
      chainId,
      domain,
      expirationTime,
      issuedAt: now,
      nonce,
      statement: "Sign in to CinaChain",
      uri,
      version: "1",
    }),
    nonce,
  }
}
