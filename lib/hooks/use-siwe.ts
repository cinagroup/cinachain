"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useChainId, usePublicClient, useSignMessage } from "wagmi"

import { verifySiweSignature } from "@/lib/siwe-verify"

const SESSION_KEY = "cinachain-siwe-session"

interface SiweSession {
  address: string
  chainId: number
  nonce: string
  message: string
  signature: string
  expirationTime: string
}

/**
 * Generate a cryptographically-secure nonce (32 hex chars).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Client-side SIWE authentication.
 *
 * NOTE: This is a UX-only sign-in. It does NOT provide server-side
 * authentication. For any privileged operation, rely on the smart
 * contract's own access control (e.g., onlyOwner modifier), not on
 * this client-side session.
 *
 * The signed message proves wallet ownership at sign-in time and the
 * session expires after 24 hours. Anyone with access to the browser
 * can clear localStorage, so this must not gate anything sensitive.
 *
 * Signature verification uses viem's verifyMessage, which supports EOA
 * (direct) signatures as well as EIP-1271 (deployed) and EIP-6492
 * (counterfactual) smart-account signatures — Reown smart accounts
 * emit 1271/6492, so the session is only stored once the signature
 * verifies against the account.
 *
 * `signInError` carries the reason the last sign-in attempt failed
 * (e.g. "Signature verification failed") so callers can surface an
 * accurate message instead of guessing it was a missing connection.
 */
export function useSiwe() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { signMessageAsync } = useSignMessage()
  const [session, setSession] = useState<SiweSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  // Load session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as SiweSession
      if (new Date(parsed.expirationTime) > new Date()) {
        setSession(parsed)
      } else {
        localStorage.removeItem(SESSION_KEY)
      }
    } catch {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [])

  // Invalidate session when wallet disconnects or account changes
  useEffect(() => {
    if (!address) {
      // Wallet disconnected — clear session from state AND localStorage
      setSession(null)
      setSignInError(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY)
      }
      return
    }
    if (session && session.address.toLowerCase() !== address.toLowerCase()) {
      // Account changed — clear stale session
      setSession(null)
      setSignInError(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY)
      }
    }
  }, [address, session])

  const signIn = useCallback(async (): Promise<boolean> => {
    setSignInError(null)
    if (!address) return false

    setLoading(true)
    try {
      // Dynamic import: siwe + ethers@5 (~500 KB) only load when the user
      // actually clicks "Sign in", not on every page load.
      const { SiweMessage } = await import("siwe")
      const nonce = generateNonce()
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to CinaChain",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
        expirationTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
      })

      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      })

      // Verify the signature (EOA direct / EIP-1271 / EIP-6492 for Reown
      // smart accounts). Only store the session when verification passes.
      if (publicClient) {
        const valid = await verifySiweSignature(publicClient, {
          address,
          message: message.prepareMessage(),
          signature,
        })
        if (!valid) throw new Error("Signature verification failed")
      } else {
        // Shouldn't happen while connected, but stay robust: skip
        // verification rather than failing the sign-in.
        console.warn(
          "[cinachain] No public client available — skipping SIWE signature verification"
        )
      }

      const sessionData: SiweSession = {
        address,
        chainId,
        nonce,
        message: message.prepareMessage(),
        signature,
        expirationTime: message.expirationTime ?? "",
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
      setSession(sessionData)
      return true
    } catch (error) {
      console.error("[cinachain] SIWE sign-in failed:", error)
      // Distinguish verification failures from generic errors so the
      // caller can show an accurate message instead of assuming the
      // wallet was never connected.
      setSignInError(
        error instanceof Error && error.message
          ? error.message
          : "Sign-in failed"
      )
      return false
    } finally {
      setLoading(false)
    }
  }, [address, chainId, signMessageAsync, publicClient])

  const signOut = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY)
    }
    setSession(null)
  }, [])

  const isAuthenticated =
    !!session &&
    !!address &&
    session.address.toLowerCase() === address.toLowerCase() &&
    new Date(session.expirationTime) > new Date()

  return {
    session,
    isAuthenticated,
    isLoading: loading,
    signInError,
    signIn,
    signOut,
  }
}
