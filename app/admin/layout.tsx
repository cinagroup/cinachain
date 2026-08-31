"use client"

import AdminGuard from "@/components/admin/admin-guard"
import { DashboardFooter } from "@/components/layout/dashboard-footer"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { ScrollArea } from "@/components/ui/scroll-area"

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
            <DashboardFooter />
          </aside>
          <main className="flex w-full flex-col overflow-hidden">{children}</main>
        </div>
      </div>
    </AdminGuard>
  )
}
