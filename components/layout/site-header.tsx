"use client"

import Link from "next/link"

import useScroll from "@/lib/hooks/use-scroll"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { IdentityHub } from "@/components/blockchain/identity-hub"
import { BrandMark, BrandName } from "@/components/brand/brand-mark"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { MainNav } from "@/components/layout/main-nav"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ModeToggle } from "@/components/shared/mode-toggle"

export function SiteHeader() {
  const scrolled = useScroll(0)
  const { t } = useI18n()

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md transition-all",
        scrolled && "shadow-vercel-sm"
      )}
      style={{ height: "64px" }}
    >
      <div className="container flex h-16 max-w-screen-ultra items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label={t("nav.homeAria")}
            className="flex items-center gap-2"
          >
            <BrandMark priority size={28} />
            <BrandName className="text-sm" />
          </Link>
          <MainNav />
        </div>
        <div className="flex items-center gap-2">
          <MobileNav />
          <div className="hidden items-center gap-2 lg:flex">
            <ModeToggle />
            <LanguageSwitcher />
          </div>
          <IdentityHub />
          <Link
            href="/mint"
            // Nav-scale CTA per DESIGN.md: 6px radius (nav-cta-signup), 28px tall
            className="hidden items-center justify-center rounded-sm bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90 lg:inline-flex"
            style={{ height: "28px" }}
          >
            {t("nav.mint")}
          </Link>
        </div>
      </div>
    </header>
  )
}
