"use client"

import { useMemo, type ReactNode } from "react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { baseSepolia } from "@reown/appkit/networks"
import { createAppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createStorage, noopStorage } from "@wagmi/core"
import { WagmiProvider } from "wagmi"

import { transports } from "@/config/networks"
import { siteConfig } from "@/config/site"
import { useColorMode } from "@/lib/state/color-mode"

const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID &&
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID !== "placeholder"
    ? process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
    : ""

if (!PROJECT_ID && process.env.NODE_ENV === "development") {
  console.warn(
    "[cinachain] NEXT_PUBLIC_REOWN_PROJECT_ID is not set. WalletConnect (mobile wallets) and Reown smart accounts will not work."
  )
}

// Reown AppKit — single wallet provider. External EOAs (injected browser
// wallets, WalletConnect, Coinbase) work out of the box; email/social
// login enables ERC-4337 smart accounts (spec: reown-smart-account-design).
//
// WagmiAdapter accepts Partial<CreateConfigParameters>, so we keep the
// custom fallback transports from config/networks (the adapter wraps them
// in an additional Reown RPC fallback) and the same localStorage/noopStorage
// split the RainbowKit provider used: wagmi's default IndexedDB storage
// crashes during static prerendering (no indexedDB global on the server),
// while AppKit's own storage is already SSR-safe (SafeLocalStorage guards
// on typeof window/localStorage).
export const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: [baseSepolia],
  transports,
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
})

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId: PROJECT_ID,
  networks: [baseSepolia],
  features: {
    // Email + social login -> Reown smart accounts (ERC-4337), coexisting
    // with external EOA connectors in the same modal.
    email: true,
    socials: ["google", "x", "github"],
  },
  metadata: {
    name: siteConfig.title,
    description: siteConfig.description,
    url: typeof window !== "undefined" ? window.location.href : "",
    icons: [],
  },
})

export function AppKitProvider({ children }: { children: ReactNode }) {
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

  // Keep AppKit's modal theme in sync with the app's color mode (the
  // themeMode passed to createAppKit only sets the initial value).
  if (typeof window !== "undefined") {
    appKit.setThemeMode(colorMode === "dark" ? "dark" : "light")
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
