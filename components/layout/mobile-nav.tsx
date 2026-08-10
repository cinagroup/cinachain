"use client"

import { useState } from "react"
import Link, { type LinkProps } from "next/link"
import { LuMenu } from "react-icons/lu"

import { menuDashboard } from "@/config/menu-dashboard"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { BrandMark, BrandName } from "@/components/brand/brand-mark"

import { ModeToggle } from "../shared/mode-toggle"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-end md:hidden">
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            className="size-11 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <LuMenu className="size-5" />
          </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="right" className="pr-0">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="flex items-center justify-between">
          <MobileLink
            href="/"
            className="flex items-center gap-2"
            onOpenChange={setOpen}
          >
            <BrandMark size={28} />
            <BrandName className="text-base" />
          </MobileLink>
          <ModeToggle />
        </div>
        <ScrollArea className="my-4 mr-4 h-[calc(100vh-8rem)] pb-10">
          <div className="flex flex-col space-y-3">
            {/* Core navigation */}
            <MobileLink
              href="/explore"
              className="text-base font-medium"
              onOpenChange={setOpen}
            >
              Explore
            </MobileLink>
            <MobileLink
              href="/mint"
              className="text-base font-medium"
              onOpenChange={setOpen}
            >
              Mint
            </MobileLink>
            <MobileLink
              href="/collections"
              className="text-base font-medium"
              onOpenChange={setOpen}
            >
              Collections
            </MobileLink>
            <MobileLink
              href="/exchange"
              className="text-base font-medium"
              onOpenChange={setOpen}
            >
              Exchange
            </MobileLink>

            <Separator />

            {/* Dashboard accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dashboard" className="border-b-0">
                <AccordionTrigger className="text-base font-medium">
                  Dashboard
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col space-y-2 pt-2">
                    {menuDashboard?.map((item, index) => (
                      <MobileLink
                        key={index}
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        onOpenChange={setOpen}
                      >
                        {item.label}
                      </MobileLink>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            <MobileLink
              href={siteConfig.links.docs}
              className="text-base font-medium"
              onOpenChange={setOpen}
            >
              Documentation
            </MobileLink>

            <div className="pr-4 pt-2">
              <SignInButton />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps) {
  return (
    <Link
      href={href}
      onClick={() => {
        onOpenChange?.(false)
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Link>
  )
}
