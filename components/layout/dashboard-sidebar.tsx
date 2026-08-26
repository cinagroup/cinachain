"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { menuAdmin } from "@/config/menu-admin"
import { menuDashboard } from "@/config/menu-dashboard"
import { useAdminCheck } from "@/lib/hooks/use-admin-check"
import { useI18n } from "@/lib/i18n"
import { SidebarNav } from "@/components/layout/sidebar-nav"

/**
 * Dashboard sidebar with admin-gated navigation.
 * Client component because admin check requires wallet state.
 */
export function DashboardSidebar() {
  const { isAdmin } = useAdminCheck()
  const { t } = useI18n()

  const userItems = menuDashboard.map((item) => ({
    ...item,
    label: t(`sidebar.${item.key}`) !== `sidebar.${item.key}` ? t(`sidebar.${item.key}`) : item.label,
  }))
  const adminItems = menuAdmin.map((item) => ({
    ...item,
    label: t(`sidebar.${item.key}`) !== `sidebar.${item.key}` ? t(`sidebar.${item.key}`) : item.label,
  }))

  return (
    <nav className="space-y-6">
      {/* Back to site */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("sidebar.backToSite")}
      </Link>

      {/* User section */}
      <div>
        <h3 className="font-mono-tech text-sm uppercase tracking-tight text-muted-foreground">
          {t("sidebar.user")}
        </h3>
        <SidebarNav items={userItems} />
      </div>

      {/* Admin section — only for admins */}
      {isAdmin && (
        <div>
          <h3 className="font-mono-tech text-sm uppercase tracking-tight text-muted-foreground">
            {t("sidebar.admin")}
          </h3>
          <SidebarNav items={adminItems} />
        </div>
      )}
    </nav>
  )
}
