"use client"

import Link from "next/link"
import { FaDiscord, FaGithub, FaTwitter } from "react-icons/fa"

import AdminGuard from "@/components/admin/admin-guard"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { ScrollArea } from "@/components/ui/scroll-area"
import { siteConfig } from "@/config/site"

/**
 * Admin pages share the dashboard sidebar (User + Admin sections, same
 * visual structure and footer) so navigating between /dashboard and /admin
 * from the sidebar never swaps the layout — only the main content changes.
 * AdminGuard still wraps the content for access control.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
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
                <Link
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="CinaChain on GitHub"
                  className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FaGithub className="size-4" />
                </Link>
                <Link
                  href={siteConfig.links.twitter}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="CinaChain on X"
                  className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FaTwitter className="size-4" />
                </Link>
                <Link
                  href={siteConfig.links.discord}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="CinaChain on Discord"
                  className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FaDiscord className="size-4" />
                </Link>
              </div>
            </footer>
          </aside>
          <main className="flex w-full flex-col overflow-hidden">{children}</main>
        </div>
      </div>
    </AdminGuard>
  )
}
