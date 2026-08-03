"use client"

import "@rainbow-me/rainbowkit/styles.css"

import { useMemo, type ReactNode } from "react"
import { env } from "@/env.mjs"
import {
  darkTheme,
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

import { chains, transports } from "@/config/networks"
import { siteConfig } from "@/config/site"
import { useColorMode } from "@/lib/state/color-mode"

const PROJECT_ID =
  env.NEXT_PUBLIC_WC_PROJECT_ID && env.NEXT_PUBLIC_WC_PROJECT_ID !== "placeholder"
    ? env.NEXT_PUBLIC_WC_PROJECT_ID
    : process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ""

if (!PROJECT_ID && process.env.NODE_ENV === "development") {
  console.warn(
    "[cinachain] NEXT_PUBLIC_WC_PROJECT_ID is not set. WalletConnect (mobile wallets) will not work."
  )
}

// getDefaultConfig already includes coinbaseWallet() with preference: 'all'.
// This means users get both Smart Wallet (passkey) and EOA options automatically.
// No explicit connectors array needed — keeping defaults preserves MetaMask,
// WalletConnect, and Coinbase Smart Wallet all at once.
const wagmiConfig = getDefaultConfig({
  appName: siteConfig.title,
  projectId: PROJECT_ID,
  chains,
  transports,
  // Static export (output: "export") has no server runtime.
  // ssr must be false to avoid hydration mismatches.
  ssr: false,
  // Coinbase Smart Wallet is enabled by default via getDefaultConfig.
  // Users will see "Coinbase Wallet" in the modal and can create
  // a passkey-based smart wallet without leaving the page.
})

export function RainbowKit({ children }: { children: ReactNode }) {
  const [colorMode] = useColorMode()
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  )
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={colorMode == "dark" ? darkTheme() : lightTheme()}
          // Enable Smart Wallet features (EIP-5792 capabilities)
          showRecentTransactions
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
