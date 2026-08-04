"use client"

import "@rainbow-me/rainbowkit/styles.css"

import { useMemo, type ReactNode } from "react"
import { env } from "@/env.mjs"
import {
  darkTheme,
  getDefaultWallets,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit"
import { createStorage, noopStorage } from "@wagmi/core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createConfig, WagmiProvider } from "wagmi"

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

// getDefaultConfig() does not expose WalletConnect options, so build the
// identical default connector set (Rainbow / Coinbase / MetaMask /
// WalletConnect) via getDefaultWallets and pass walletConnectParameters:
//   - metadata: mirrors what getDefaultConfig computes for its connectors
//   - telemetryEnabled: false -> stops pulse.walletconnect.org telemetry POSTs
const { connectors } = getDefaultWallets({
  appName: siteConfig.title,
  projectId: PROJECT_ID,
  walletConnectParameters: {
    metadata: {
      name: siteConfig.title,
      description: siteConfig.description,
      url: typeof window !== "undefined" ? window.location.href : "",
      icons: [],
    },
    telemetryEnabled: false,
  },
})

// coinbaseWallet() with preference: 'all' is included by getDefaultWallets,
// so users get both Smart Wallet (passkey) and EOA options automatically.
const wagmiConfig = createConfig({
  chains,
  transports,
  connectors,
  // wagmi's default storage uses IndexedDB, which crashes during static
  // prerendering (no indexedDB global on the server). localStorage on the
  // client, noop on the server.
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
  // Static export (output: "export") has no server runtime.
  // ssr must be false to avoid hydration mismatches.
  ssr: false,
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
