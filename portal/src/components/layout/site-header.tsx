import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/cn"
import { dapp, links } from "@/lib/site"
import { BrandMark, BrandName } from "@/components/brand-mark"
import { ModeToggle } from "@/components/shared/mode-toggle"

const navLinks = [
  { label: "DApp", href: links.dapp },
  { label: "Docs", href: links.docs },
  { label: "Collections", href: dapp.collections },
  { label: "GitHub", href: links.github },
] as const

export function SiteHeader() {
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
            aria-label="CinaChain home"
            className="flex min-h-11 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BrandMark size={28} />
            <BrandName className="text-sm" />
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <a
            href={dapp.explore}
            className="inline-flex h-11 items-center justify-center gap-1 rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Enter DApp
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  )
}
