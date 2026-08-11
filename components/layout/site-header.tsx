"use client"

import Link from "next/link"

import useScroll from "@/lib/hooks/use-scroll"
import { cn } from "@/lib/utils"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { BrandMark, BrandName } from "@/components/brand/brand-mark"
import { MainNav } from "@/components/layout/main-nav"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ModeToggle } from "@/components/shared/mode-toggle"

export function SiteHeader() {
  const scrolled = useScroll(0)

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
            aria-label="CinaChain home"
            className="flex items-center gap-2"
          >
            <BrandMark priority size={28} />
            <BrandName className="text-sm" />
          </Link>
          <MainNav />
        </div>
        <MobileNav />
        <div className="hidden items-center gap-2 md:flex">
          <ModeToggle />
          <SignInButton />
          <Link
            href="/mint"
            // Nav-scale CTA per DESIGN.md: 6px radius (nav-cta-signup), 28px tall
            className="inline-flex items-center justify-center rounded-sm bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            style={{ height: "28px" }}
          >
            Mint NFT
          </Link>
        </div>
      </div>
    </header>
  )
}
