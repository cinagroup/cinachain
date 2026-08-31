import "@/styles/globals.css"

import { ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { env } from "@/env.mjs"

import { siteConfig } from "@/config/site"
import { fontMono, fontSans } from "@/lib/fonts"
import { I18nProvider } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import RootProvider from "@/components/providers/root-provider"
import { PWARegister } from "@/components/pwa/pwa-register"

const url = env.NEXT_PUBLIC_SITE_URL || "https://nft.cinachain.com"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#131313" },
  ],
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: url?.toString(),
    siteName: siteConfig.name,
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/opengraph-image.png"],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable,
            fontMono.variable
          )}
        >
          <I18nProvider>
            <RootProvider>{children}</RootProvider>
          </I18nProvider>
          <Toaster />
          <PWARegister />
        </body>
      </html>
    </>
  )
}
