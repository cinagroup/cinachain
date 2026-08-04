"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useSiwe } from "@/lib/hooks/use-siwe"

const KEYS_STORAGE = "cinachain-api-keys"

export interface ApiKeyRecord {
  id: string
  prefix: string // first 8 chars for display
  createdAt: number
}

/** SIWE-gated API key management. Demo storage: localStorage per address;
 *  the billing worker stores only the SHA-256 hash of the key. */
export function useApiKeys() {
  const { address } = useAccount()
  const { isAuthenticated, signIn } = useSiwe()
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])

  useEffect(() => {
    if (!address) return
    try {
      const raw = localStorage.getItem(`${KEYS_STORAGE}:${address.toLowerCase()}`)
      if (raw) setKeys(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [address])

  const persist = useCallback(
    (next: ApiKeyRecord[]) => {
      if (!address) return
      setKeys(next)
      try {
        localStorage.setItem(`${KEYS_STORAGE}:${address.toLowerCase()}`, JSON.stringify(next))
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
    const raw = `cina_${crypto.randomUUID().replace(/-/g, "")}${crypto
      .getRandomValues(new Uint32Array(4))
      .join("")}`
    const rec: ApiKeyRecord = { id: raw, prefix: raw.slice(0, 8), createdAt: Date.now() }
    persist([...keys, rec])
    return raw
  }, [isAuthenticated, signIn, keys, persist])

  const revokeKey = useCallback(
    (id: string) => {
      persist(keys.filter((k) => k.id !== id))
    },
    [keys, persist]
  )

  return { keys, isAuthenticated, signIn, createKey, revokeKey }
}
