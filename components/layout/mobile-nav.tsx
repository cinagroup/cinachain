"use client"

import { useState } from "react"
import Link, { type LinkProps } from "next/link"
import { usePathname } from "next/navigation"
import { LuMenu } from "react-icons/lu"

import { menuDashboard } from "@/config/menu-dashboard"
import { siteConfig } from "@/config/site"
import { useI18n } from "@/lib/i18n"
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
import { BrandMark, BrandName } from "@/components/brand/brand-mark"
import { LanguageSwitcher } from "@/components/layout/language-switcher"

import { ModeToggle } from "../shared/mode-toggle"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useI18n()
  const isDashboardActive = isActivePath(pathname, "/dashboard")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-end lg:hidden">
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.openMenu")}
            className="size-11 text-base hover:bg-transparent focus-visible:bg-transparent"
          >
            <LuMenu className="size-5" />
          </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="right" className="pr-0">
        <SheetTitle className="sr-only">{t("nav.menuTitle")}</SheetTitle>
        <div className="mr-4 flex items-center justify-between">
          <MobileLink
            href="/"
            className="flex items-center gap-2"
            onOpenChange={setOpen}
          >
            <BrandMark size={28} />
            <BrandName className="text-base" />
          </MobileLink>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ModeToggle />
          </div>
        </div>
        <ScrollArea className="my-4 mr-4 h-[calc(100vh-8rem)] pb-10">
          <div className="flex flex-col space-y-3">
            {/* Core navigation */}
            <MobileLink
              href="/explore"
              className="text-base font-medium"
              isActive={isActivePath(pathname, "/explore")}
              onOpenChange={setOpen}
            >
              {t("nav.explore")}
            </MobileLink>
            <MobileLink
              href="/mint"
              className="text-base font-medium"
              isActive={isActivePath(pathname, "/mint")}
              onOpenChange={setOpen}
            >
              {t("nav.mint")}
            </MobileLink>
            <MobileLink
              href="/collections"
              className="text-base font-medium"
              isActive={isActivePath(pathname, "/collections")}
              onOpenChange={setOpen}
            >
              {t("nav.collections")}
            </MobileLink>
            <MobileLink
              href="/exchange"
              className="text-base font-medium"
              isActive={isActivePath(pathname, "/exchange")}
              onOpenChange={setOpen}
            >
              {t("nav.exchange")}
            </MobileLink>

            <Separator />

            {/* Dashboard accordion */}
            <Accordion
              type="single"
              collapsible
              defaultValue={isDashboardActive ? "dashboard" : undefined}
              className="w-full"
            >
              <AccordionItem value="dashboard" className="border-b-0">
                <AccordionTrigger className="min-h-11 rounded-md px-3 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {t("nav.dashboard")}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col space-y-2 pt-2">
                    {menuDashboard?.map((item, index) => (
                      <MobileLink
                        key={index}
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        isActive={isActivePath(pathname, item.href)}
                        onOpenChange={setOpen}
                      >
                        {t(`sidebar.${item.key}`)}
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
              {t("nav.documentation")}
            </MobileLink>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void
  isActive?: boolean
  children: React.ReactNode
  className?: string
}

function MobileLink({
  href,
  onOpenChange,
  isActive = false,
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
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
        isActive && "bg-secondary text-foreground"
      )}
      {...props}
    >
      {children}
    </Link>
  )
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
