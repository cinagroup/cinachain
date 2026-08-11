"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

const primaryLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/mint", label: "Mint" },
  { href: "/collections", label: "Collections" },
  { href: "/exchange", label: "Exchange" },
  { href: "/dashboard", label: "Dashboard" },
] as const

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {primaryLinks.map(({ href, label }) => {
        const isActive = isActivePath(pathname, href)

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-sm px-3 py-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive ? "text-foreground" : "text-body"
            )}
          >
            {label}
          </Link>
        )
      })}
      <Link
        href={siteConfig.links.docs}
        className="rounded-sm px-3 py-2 text-sm font-medium text-body transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Documentation
      </Link>
    </nav>
  )
}
