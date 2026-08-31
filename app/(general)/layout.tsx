import { ReactNode } from "react"

import { NetworkStatus } from "@/components/blockchain/network-status"
import { Footer } from "@/components/layout/footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <SkipLink />
      <div className="relative flex min-h-screen flex-col">
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
      <NetworkStatus />
    </>
  )
}
