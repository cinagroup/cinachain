import Link from "next/link"
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa"

import { siteConfig } from "@/config/site"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { SiteHeader } from "@/components/layout/site-header"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="-ml-2 hidden w-full shrink-0 md:sticky md:top-20 md:flex md:h-[calc(100vh-5rem)] md:flex-col">
          <ScrollArea className="flex-1 py-6 pr-6 lg:py-8">
            <DashboardSidebar />
          </ScrollArea>
          <footer className="mt-auto flex flex-col border-t pb-6 pr-2 pt-4">
            <h3 className="font-display text-sm">{siteConfig.title}</h3>
            <Link
              href="/"
              className="w-fit py-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Built by cinagroup
            </Link>
            <div className="mt-2 flex items-center space-x-3">
              <Link href={siteConfig.links.github} className="text-muted-foreground hover:text-foreground">
                <FaGithub className="size-4" />
              </Link>
              <Link href={siteConfig.links.twitter} className="text-muted-foreground hover:text-foreground">
                <FaTwitter className="size-4" />
              </Link>
              <Link href={siteConfig.links.discord} className="text-muted-foreground hover:text-foreground">
                <FaDiscord className="size-4" />
              </Link>
            </div>
          </footer>
        </aside>
        <main className="flex w-full flex-col overflow-hidden">{children}</main>
      </div>
      <div className="fixed bottom-6 right-6 z-50">
        <WalletConnect />
      </div>
    </div>
  )
}
