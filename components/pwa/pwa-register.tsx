"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    // The SW precaches HTML (cache-first) and takes over immediately via
    // skipWaiting — in dev this serves stale pages to a freshly compiled
    // server, which manifests as React hydration mismatches. PWA is a
    // production feature; skip registration during development.
    if (process.env.NODE_ENV !== "production") return
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registered:", registration.scope)
          })
          .catch((error) => {
            console.log("[PWA] Service Worker registration failed:", error)
          })
      })
    }
  }, [])

  return null
}
