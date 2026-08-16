"use client"

import { ReactNode } from "react"
import { ThemeProvider } from "next-themes"

import { AppKitProvider } from "@/components/providers/appkit-provider"

interface RootProviderProps {
  children: ReactNode
}

/**
 * App-wide providers.
 *
 * NOTE: no `useIsMounted` gate here. Previously the gate returned `null`
 * until mount, which made the static export ship an empty <body> and hurt
 * LCP/SEO. Theme hydration is covered by `suppressHydrationWarning` on
 * <html> (app/layout.tsx). AppKit/Wagmi use their SSR-safe path and hydrate
 * wallet state client-side, so real content renders in exported HTML.
 */
export default function RootProvider({ children }: RootProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AppKitProvider>{children}</AppKitProvider>
    </ThemeProvider>
  )
}
