"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  beginCinaauthPopupLogin,
  CINAAUTH_SESSION_KEY,
  endCinaauthSession,
  isCinaauthConfigured,
  loadCinaauthSession,
  toCinaauthErrorMessage,
  type CinaauthSession,
} from "@/lib/auth/cinaauth"
import {
  CINAAUTH_POPUP_CHANNEL,
  isCinaauthPopupMessage,
} from "@/lib/auth/cinaauth-popup"

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
  const [isSigningIn, setIsSigningIn] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const popupAttemptRef = useRef<string | null>(null)
  const popupPollRef = useRef<number | null>(null)

  const stopPopupPoll = useCallback(() => {
    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current)
      popupPollRef.current = null
    }
  }, [])

  const closePopup = useCallback(() => {
    popupRef.current?.close()
    popupRef.current = null
    popupAttemptRef.current = null
  }, [])

  const syncStoredSession = useCallback(() => {
    const stored = loadCinaauthSession()
    setSession(stored)
    return stored
  }, [])

  useEffect(() => {
    setSession(loadCinaauthSession())
  }, [])

  useEffect(() => {
    function finishFromStorage() {
      const stored = syncStoredSession()
      if (stored) setError(null)
      setIsSigningIn(false)
      stopPopupPoll()
      closePopup()
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === CINAAUTH_SESSION_KEY) finishFromStorage()
    }

    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CINAAUTH_POPUP_CHANNEL)
    if (channel) {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (!isCinaauthPopupMessage(event.data)) return
        if (event.data.attemptId !== popupAttemptRef.current) return
        if (event.data.status === "error") {
          setError(event.data.message)
          setIsSigningIn(false)
          stopPopupPoll()
          closePopup()
          return
        }
        finishFromStorage()
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
      channel?.close()
      stopPopupPoll()
      closePopup()
    }
  }, [closePopup, stopPopupPoll, syncStoredSession])

  const signIn = useCallback(
    async () => {
      const existingPopup = popupRef.current
      if (existingPopup && !existingPopup.closed) {
        existingPopup.focus()
        return true
      }

      setError(null)
      setIsSigningIn(true)
      try {
        const launch = await beginCinaauthPopupLogin()

        popupRef.current = launch.popup
        popupAttemptRef.current = launch.attemptId
        stopPopupPoll()
        popupPollRef.current = window.setInterval(() => {
          if (!launch.popup.closed) return
          stopPopupPoll()
          popupRef.current = null
          const stored = syncStoredSession()
          setIsSigningIn(false)
          if (stored) {
            setError(null)
          } else {
            setError(
              (current) =>
                current ??
                "The CinaSeek sign-in window was closed before sign-in completed."
            )
          }
        }, 400)
        return true
      } catch (cause: unknown) {
        const message = toCinaauthErrorMessage(cause)
        console.error("[cinachain] CinaAuth sign-in failed:", message)
        setIsSigningIn(false)
        setError(message)
        return false
      }
    },
    [stopPopupPoll, syncStoredSession]
  )

  const signOut = useCallback(() => {
    stopPopupPoll()
    closePopup()
    setIsSigningIn(false)
    setSession(null)
    void endCinaauthSession()
  }, [closePopup, stopPopupPoll])

  return {
    session: session ?? null,
    user: session?.user ?? null,
    isAuthenticated: session != null,
    isLoading: session === undefined || isSigningIn,
    isSigningIn,
    isConfigured: isCinaauthConfigured(),
    error,
    signIn,
    signOut,
  }
}
