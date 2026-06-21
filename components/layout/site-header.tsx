"use client"

import Image from "next/image"
import Link from "next/link"

import useScroll from "@/lib/hooks/use-scroll"
import { cn } from "@/lib/utils"
import { MainNav } from "@/components/layout/main-nav"
import { MobileNav } from "@/components/layout/mobile-nav"
import { ModeToggle } from "@/components/shared/mode-toggle"
import { SignInButton } from "@/components/blockchain/sign-in-button"

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
      <div className="container flex h-16 max-w-[1400px] items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/favicon.ico"
              alt="CinaChain Logo"
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="font-display text-sm tracking-tight">CinaChain</span>
          </Link>
          <MainNav />
        </div>
        <MobileNav />
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-sm px-2 text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            style={{ height: "28px" }}
          >
            Dashboard
          </Link>
          <ModeToggle />
          <SignInButton />
          <Link
            href="/mint"
            className="btn-pill inline-flex items-center justify-center bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            style={{ height: "28px" }}
          >
            Mint NFT
          </Link>
        </div>
      </div>
    </header>
  )
}
