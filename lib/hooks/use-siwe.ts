"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useSignMessage, useChainId } from "wagmi"
import { SiweMessage } from "siwe"

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
 */
export function useSiwe() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const [session, setSession] = useState<SiweSession | null>(null)
  const [loading, setLoading] = useState(false)

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

  // Invalidate session when wallet account changes
  useEffect(() => {
    if (!address) {
      setSession(null)
      return
    }
    if (session && session.address.toLowerCase() !== address.toLowerCase()) {
      setSession(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY)
      }
    }
  }, [address, session])

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address) return false

    setLoading(true)
    try {
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
      return false
    } finally {
      setLoading(false)
    }
  }, [address, chainId, signMessageAsync])

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
    signIn,
    signOut,
  }
}
