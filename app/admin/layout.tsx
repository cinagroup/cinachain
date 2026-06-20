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
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside className="w-64 border-r bg-muted/40 hidden md:block">
            <nav className="p-4 space-y-2">
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
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
