"use client"

import AdminGuard from "@/components/admin/admin-guard"
import { SiteHeader } from "@/components/layout/site-header"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, BarChart3, Settings } from "lucide-react"

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/whitelist", label: "Whitelist", icon: Users },
  { href: "/admin/stats", label: "Statistics", icon: BarChart3 },
  { href: "/admin/contract", label: "Contract", icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AdminGuard>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          {/* Sidebar */}
          <aside className="hidden w-64 border-r bg-muted/40 md:block">
            <nav className="space-y-2 p-4">
              {adminNav.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2",
                      isActive && "bg-secondary"
                    )}
                  >
                    <Link href={item.href}>
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
