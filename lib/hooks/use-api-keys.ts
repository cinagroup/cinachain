"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"

import { useSiwe } from "@/lib/hooks/use-siwe"

const KEYS_STORAGE = "cinachain-api-keys"
const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://cinachain-billing.cinagroup.workers.dev"

export interface ApiKeyRecord {
  id: string
  prefix: string // first 8 chars for display
  createdAt: number
}

/** SIWE-gated API key management. Demo storage: localStorage per address;
 *  the billing worker stores only the SHA-256 hash of the key. */
export function useApiKeys() {
  const { address } = useAccount()
  const { isAuthenticated, signIn, signInError } = useSiwe()
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])

  useEffect(() => {
    // Reset first so switching accounts never shows another address's
    // keys (or a stale list from the previous address).
    setKeys([])
    if (!address) return
    try {
      const raw = localStorage.getItem(
        `${KEYS_STORAGE}:${address.toLowerCase()}`
      )
      if (raw) {
        const parsed = JSON.parse(raw)
        setKeys(Array.isArray(parsed) ? parsed : [])
      }
    } catch {
      /* ignore */
    }
  }, [address])

  const persist = useCallback(
    (next: ApiKeyRecord[]) => {
      if (!address) return
      setKeys(next)
      try {
        localStorage.setItem(
          `${KEYS_STORAGE}:${address.toLowerCase()}`,
          JSON.stringify(next)
        )
      } catch {
        /* ignore */
      }
    },
    [address]
  )

  const createKey = useCallback(async () => {
    if (!isAuthenticated) {
      const ok = await signIn()
      if (!ok) throw new Error("SIWE sign-in required")
    }
    if (!address) throw new Error("Wallet not connected")
    const raw = `cina_${crypto.randomUUID().replace(/-/g, "")}${crypto
      .getRandomValues(new Uint32Array(4))
      .join("")}`
    const rec: ApiKeyRecord = {
      id: raw,
      prefix: raw.slice(0, 8),
      createdAt: Date.now(),
    }
    persist([...keys, rec])
    // Register the key with the billing gateway so /v1/usage can resolve it.
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: raw, address }),
      })
      if (!res.ok)
        throw new Error("Failed to register key with billing gateway")
    } catch (err) {
      // Roll back the locally-created key so state stays consistent.
      persist(keys)
      throw err
    }
    return raw
  }, [isAuthenticated, signIn, address, keys, persist])

  const revokeKey = useCallback(
    (id: string) => {
      persist(keys.filter((k) => k.id !== id))
    },
    [keys, persist]
  )

  return { keys, isAuthenticated, signIn, signInError, createKey, revokeKey }
}
