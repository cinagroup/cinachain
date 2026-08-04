"use client"

import { ReactNode } from "react"
import { ThemeProvider } from "next-themes"

import HandleWalletEvents from "@/components/blockchain/handle-wallet-events"
import { RainbowKit } from "@/components/providers/rainbow-kit"

interface RootProviderProps {
  children: ReactNode
}

/**
 * App-wide providers.
 *
 * NOTE: no `useIsMounted` gate here. Previously the gate returned `null`
 * until mount, which made the static export ship an empty <body> and hurt
 * LCP/SEO. Theme hydration is covered by `suppressHydrationWarning` on
 * <html> (app/layout.tsx) and wallet state is hydrated client-side by
 * RainbowKit (ssr: false), so real content now renders from the exported
 * HTML immediately.
 */
export default function RootProvider({ children }: RootProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <RainbowKit>
        <HandleWalletEvents>{children}</HandleWalletEvents>
      </RainbowKit>
    </ThemeProvider>
  )
}
