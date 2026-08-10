"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    // PWA caching is a production-only concern. Keeping it disabled in local
    // development prevents stale build assets from masking fresh changes.
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        })
        await registration.update()
      } catch (error) {
        console.warn("[PWA] Service Worker registration failed:", error)
      }
    }

    if (document.readyState === "complete") {
      void register()
      return
    }

    window.addEventListener("load", register, { once: true })
    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
