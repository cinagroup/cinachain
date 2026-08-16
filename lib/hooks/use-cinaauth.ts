"use client"

import { useCallback, useEffect, useState } from "react"

import {
  type CinaauthSession,
  beginCinaauthLogin,
  clearCinaauthSession,
  endCinaauthSession,
  isCinaauthConfigured,
  loadCinaauthSession,
  refreshCinaauthSession,
  toCinaauthErrorMessage,
} from "@/lib/auth/cinaauth"

/**
 * CinaAuth sign-in state for the app shell (header button, account page).
 *
 * `session` is `undefined` until the stored session has been loaded on
 * mount (and refreshed if its access token expired), so `isLoading` is
 * distinguishable from "signed out" without hydration mismatches.
 */
export function useCinaauth() {
  const [session, setSession] = useState<CinaauthSession | null | undefined>(
    undefined
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const stored = loadCinaauthSession()
      if (!stored) {
        setSession(null)
        return
      }
      // Refresh proactively once the access token is within a minute of
      // expiry; drop the session when the grant is rejected.
      if (stored.expiresAt > Date.now() + 60_000) {
        setSession(stored)
        return
      }
      try {
        const refreshed = await refreshCinaauthSession(stored)
        if (cancelled) return
        if (refreshed) {
          setSession(refreshed)
        } else {
          clearCinaauthSession()
          setSession(null)
        }
      } catch (cause: unknown) {
        if (cancelled) return
        console.warn(
          "[cinachain] CinaAuth session refresh failed:",
          toCinaauthErrorMessage(cause)
        )
        clearCinaauthSession()
        setSession(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (returnTo?: string) => {
    setError(null)
    try {
      await beginCinaauthLogin(returnTo ?? "/dashboard")
    } catch (cause: unknown) {
      const message = toCinaauthErrorMessage(cause)
      console.error("[cinachain] CinaAuth sign-in failed:", message)
      setError(message)
    }
  }, [])

  const signOut = useCallback(() => {
    const current = session ?? loadCinaauthSession() ?? null
    setSession(null)
    void endCinaauthSession(current)
  }, [session])

  return {
    session: session ?? null,
    user: session?.user ?? null,
    isAuthenticated: session != null,
    isLoading: session === undefined,
    isConfigured: isCinaauthConfigured(),
    error,
    signIn,
    signOut,
  }
}
