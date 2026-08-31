"use client"

import { useEffect, useRef } from "react"

import {
  completeCinaauthLogin,
  toCinaauthErrorMessage,
} from "@/lib/auth/cinaauth"
import {
  CINAAUTH_POPUP_MARKER_KEY,
  createCinaauthPopupMessage,
  isCinaauthPopupContext,
  publishCinaauthPopupMessage,
} from "@/lib/auth/cinaauth-popup"
/**
 * Invisible CinaAuth OIDC callback endpoint. It exists only inside the popup,
 * performs the client-side PKCE exchange, notifies the original CinaChain
 * page without passing tokens, and closes itself.
 */
export default function CinaauthCallbackPage() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const attemptId = sessionStorage.getItem(CINAAUTH_POPUP_MARKER_KEY)
    if (!isCinaauthPopupContext(attemptId)) {
      window.close()
      return
    }

    completeCinaauthLogin(attemptId)
      .then((result) => {
        if (result.attemptId !== attemptId) return
        publishCinaauthPopupMessage(
          createCinaauthPopupMessage("success", attemptId)
        )
        window.close()
      })
      .catch((cause: unknown) => {
        const message = toCinaauthErrorMessage(cause)
        publishCinaauthPopupMessage(
          createCinaauthPopupMessage("error", attemptId, message)
        )
        window.close()
      })
  }, [])

  return null
}
