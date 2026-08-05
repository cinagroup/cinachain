"use client"

import { useEffect, useState } from "react"
import { AppKitButton } from "@reown/appkit/react"

/**
 * AppKit's connect button, rendered client-side only.
 *
 * The @lit/react wrapper around <appkit-button> calls React hooks (useRef)
 * inside its component body. The Next.js server bundle resolves `react`
 * through an interop that lacks hooks, so rendering it during static
 * generation crashes with `e.useRef is not a function`. Rendering after
 * mount (classic useIsMounted gate) keeps the exported HTML clean and the
 * button hydrates on the client, where the full react build is available.
 */
export function AppKitConnectButton({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return <AppKitButton balance="hide" className={className} />
}
