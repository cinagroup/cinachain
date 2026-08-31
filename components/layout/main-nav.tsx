"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { siteConfig } from "@/config/site"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const primaryLinks = [
  { href: "/explore", key: "nav.explore", fallback: "Explore" },
  { href: "/mint", key: "nav.mint", fallback: "Mint" },
  { href: "/collections", key: "nav.collections", fallback: "Collections" },
  { href: "/exchange", key: "nav.exchange", fallback: "Exchange" },
  { href: "/dashboard", key: "nav.dashboard", fallback: "Dashboard" },
] as const

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MainNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav
      aria-label={t("nav.primary")}
      className="hidden items-center gap-1 lg:flex"
    >
      {primaryLinks.map(({ href, key, fallback }) => {
        const isActive = isActivePath(pathname, href)
        const label = t(key) !== key ? t(key) : fallback

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
        {t("nav.documentation")}
      </Link>
    </nav>
  )
}
