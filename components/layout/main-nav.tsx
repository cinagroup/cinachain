"use client"

import Link from "next/link"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { siteConfig } from "@/config/site"

export function MainNav() {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {/* Core product links */}
      <Link
        href="/explore"
        className="rounded-sm px-3 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        Explore
      </Link>
      <Link
        href="/mint"
        className="rounded-sm px-3 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        Mint
      </Link>

      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link href="/dashboard">
              <NavigationMenuLink className="h-8 rounded-sm text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
                Dashboard
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href={siteConfig.links.docs}>
              <NavigationMenuLink className="h-8 rounded-sm text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
                Documentation
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}
