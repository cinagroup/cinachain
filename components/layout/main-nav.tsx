import Link from "next/link"

import { siteConfig } from "@/config/site"

export function MainNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {/* Core product links */}
      <Link
        href="/explore"
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Explore
      </Link>
      <Link
        href="/mint"
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Mint
      </Link>
      <Link
        href="/collections"
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Collections
      </Link>
      <Link
        href="/exchange"
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Exchange
      </Link>

      <Link
        href="/dashboard"
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Dashboard
      </Link>
      <Link
        href={siteConfig.links.docs}
        className="rounded-sm px-3 text-sm font-medium text-body transition-colors hover:text-foreground"
      >
        Documentation
      </Link>
    </nav>
  )
}
