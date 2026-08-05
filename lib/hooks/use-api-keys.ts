"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount, useSignMessage } from "wagmi"

import {
  buildBindingMessage,
  generateBindingNonce,
} from "@/lib/binding-message"
import { useSiwe } from "@/lib/hooks/use-siwe"

const KEYS_STORAGE = "cinachain-api-keys"
const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://billing-api.cinachain.com"

export interface ApiKeyRecord {
  id: string
  prefix: string // first 8 chars for display
  createdAt: number
}

/** SIWE-gated API key management. Demo storage: localStorage per address;
 *  the billing worker stores only the SHA-256 hash of the key. */
export function useApiKeys() {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
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
    // The gateway requires a fresh SIWE-style binding message signed by the
    // address (EOA personal_sign; deployed smart accounts via EIP-1271) to
    // prove ownership — the worker rejects expired or replayed nonces.
    try {
      const issuedAt = new Date().toISOString()
      const message = buildBindingMessage(address, generateBindingNonce(), issuedAt)
      const signature = await signMessageAsync({ message })
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        const res = await fetch(`${BILLING_API_URL}/v1/keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ apiKey: raw, address, message, signature }),
        })
        if (!res.ok) {
          // Surface the gateway's reason (e.g. counterfactual smart account
          // must deploy first) instead of a generic failure.
          const errBody = await res.json().catch(() => null)
          throw new Error(
            errBody?.error || "Failed to register key with billing gateway"
          )
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      // Roll back the locally-created key so state stays consistent.
      persist(keys)
      throw err
    }
    return raw
  }, [isAuthenticated, signIn, address, signMessageAsync, keys, persist])

  const revokeKey = useCallback(
    (id: string) => {
      persist(keys.filter((k) => k.id !== id))
    },
    [keys, persist]
  )

  return { keys, isAuthenticated, signIn, signInError, createKey, revokeKey }
}
