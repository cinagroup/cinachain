"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { env } from "@/env.mjs"
import type { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import type { AppKit } from "@reown/appkit/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createConfig,
  createStorage,
  noopStorage,
  type Config,
} from "@wagmi/core"
import { useTheme } from "next-themes"
import { WagmiProvider } from "wagmi"

import { chains, transports } from "@/config/networks"
import { siteConfig } from "@/config/site"

const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID &&
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID !== "placeholder"
    ? process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
    : ""

const APP_URL =
  env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "https://nft.cinachain.com")

export const isAppKitConfigured = Boolean(PROJECT_ID)

if (!PROJECT_ID && process.env.NODE_ENV === "development") {
  console.info(
    "[cinachain] NEXT_PUBLIC_REOWN_PROJECT_ID is not set. WalletConnect (mobile wallets) and Reown smart accounts will not work."
  )
}

const wagmiStorage = createStorage({
  storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
})

// A side-effect-free config keeps every page renderable when Reown is not
// configured. In particular, it cannot restore an old WalletConnect session
// and surface AppKit's global "Project ID Missing" dialog.
const fallbackWagmiConfig = createConfig({
  chains,
  transports,
  ssr: true,
  storage: wagmiStorage,
})

let wagmiAdapterPromise: Promise<WagmiAdapter | null> | null = null

function getWagmiAdapter(): Promise<WagmiAdapter | null> {
  if (typeof window === "undefined" || !isAppKitConfigured) {
    return Promise.resolve(null)
  }

  if (!wagmiAdapterPromise) {
    wagmiAdapterPromise = import("@reown/appkit-adapter-wagmi").then(
      ({ WagmiAdapter }) =>
        new WagmiAdapter({
          projectId: PROJECT_ID,
          networks: chains,
          transports,
          ssr: true,
          storage: wagmiStorage,
        })
    )
  }

  return wagmiAdapterPromise
}

let appKitPromise: Promise<AppKit | null> | null = null

// Loading AppKit registers custom elements and initializes browser-only
// telemetry. Keep those side effects out of static prerendering and out of
// deployments where the Reown project id is intentionally absent.
export function getAppKit(): Promise<AppKit | null> {
  if (typeof window === "undefined" || !isAppKitConfigured) {
    return Promise.resolve(null)
  }

  if (!appKitPromise) {
    appKitPromise = getWagmiAdapter()
      .then(async (wagmiAdapter) => {
        if (!wagmiAdapter) return null
        const { createAppKit } = await import("@reown/appkit/react")
        return createAppKit({
          adapters: [wagmiAdapter],
          projectId: PROJECT_ID,
          networks: chains,
          features: {
            // Email + social login -> Reown smart accounts (ERC-4337),
            // coexisting with external EOA connectors in the same modal.
            email: true,
            socials: ["google", "x", "github"],
          },
          metadata: {
            name: siteConfig.title,
            description: siteConfig.description,
            url: APP_URL,
            icons: [],
          },
        })
      })
      .catch((error) => {
        appKitPromise = null
        console.error("[cinachain] AppKit initialization failed.", error)
        return null
      })
  }

  return appKitPromise
}

export async function openAppKit(view: "Account" | "Connect") {
  const instance = await getAppKit()
  await instance?.open({ view })
}

export type EmbeddedWalletAccountType = "eoa" | "smartAccount" | null

export async function subscribeEmbeddedWalletAccountType(
  onChange: (accountType: EmbeddedWalletAccountType) => void
): Promise<() => void> {
  const instance = await getAppKit()
  if (!instance) return () => undefined

  const emitAccountType = (account?: {
    embeddedWalletInfo?: { accountType?: string }
  }) => {
    const accountType = account?.embeddedWalletInfo?.accountType
    onChange(
      accountType === "smartAccount"
        ? "smartAccount"
        : accountType === "eoa"
        ? "eoa"
        : null
    )
  }

  try {
    emitAccountType(instance.getAccount())
    return instance.subscribeAccount((account) => emitAccountType(account))
  } catch {
    onChange(null)
    return () => undefined
  }
}

export function AppKitProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [walletConfig, setWalletConfig] = useState<Config>(
    fallbackWagmiConfig as Config
  )
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

  useEffect(() => {
    if (!isAppKitConfigured) return

    let cancelled = false
    void getWagmiAdapter().then((adapter) => {
      if (cancelled || !adapter) return
      setWalletConfig(adapter.wagmiConfig)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Keep AppKit's modal theme in sync with next-themes (the themeMode
  // passed to createAppKit only sets the initial value). resolvedTheme
  // resolves "system" to dark/light at runtime, so the modal follows the
  // actually rendered theme. AppKitProvider sits inside next-themes'
  // ThemeProvider (root-provider.tsx), so useTheme() is available here.
  useEffect(() => {
    if (!isAppKitConfigured) return

    let cancelled = false
    void getAppKit().then((instance) => {
      if (cancelled) return
      instance?.setThemeMode?.(resolvedTheme === "dark" ? "dark" : "light")
    })

    return () => {
      cancelled = true
    }
  }, [resolvedTheme])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider
        config={walletConfig}
        reconnectOnMount={isAppKitConfigured}
      >
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
