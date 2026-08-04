"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { menuAdmin } from "@/config/menu-admin"
import { menuDashboard } from "@/config/menu-dashboard"
import { useAdminCheck } from "@/lib/hooks/use-admin-check"
import { SidebarNav } from "@/components/layout/sidebar-nav"

/**
 * Dashboard sidebar with admin-gated navigation.
 * Client component because admin check requires wallet state.
 */
export function DashboardSidebar() {
  const { isAdmin } = useAdminCheck()

  return (
    <nav className="space-y-6">
      {/* Back to site */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to site
      </Link>

      {/* User section */}
      <div>
        <h3 className="font-display text-sm uppercase tracking-tight text-muted-foreground">
          User
        </h3>
        <SidebarNav items={menuDashboard} />
      </div>

      {/* Admin section — only for admins */}
      {isAdmin && (
        <div>
          <h3 className="font-display text-sm uppercase tracking-tight text-muted-foreground">
            Admin
          </h3>
          <SidebarNav items={menuAdmin} />
        </div>
      )}
    </nav>
  )
}
