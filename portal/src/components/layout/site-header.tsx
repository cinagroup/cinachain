import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/cn"
import { useI18n } from "@/lib/i18n"
import { dapp, links } from "@/lib/site"
import { BrandMark, BrandName } from "@/components/brand-mark"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { ModeToggle } from "@/components/shared/mode-toggle"

const navLinks = [
  { labelKey: "nav.dapp", href: links.dapp },
  { labelKey: "nav.docs", href: links.docs },
  { labelKey: "nav.collections", href: dapp.collections },
  { labelKey: "nav.github", href: links.github },
] as const

export function SiteHeader() {
  const { t } = useI18n()

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md"
      )}
      style={{ height: "64px" }}
    >
      <div className="container flex h-16 max-w-screen-ultra items-center justify-between">
        <div className="flex items-center gap-6">
          <a
            href="/"
            aria-label={t("aria.home")}
            className="flex min-h-11 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BrandMark size={28} />
            <BrandName className="hidden text-sm sm:inline" />
          </a>

          <nav
            aria-label={t("nav.primary")}
            className="hidden items-center gap-1 md:flex"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ModeToggle />
          <a
            href={dapp.explore}
            aria-label={t("nav.enterDapp")}
            className="inline-flex size-11 items-center justify-center gap-1 rounded-sm bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto sm:px-4"
          >
            <span className="hidden sm:inline">{t("nav.enterDapp")}</span>
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  )
}
