"use client"

import { Languages } from "lucide-react"

import { useI18n, LOCALE_LABELS, type Locale } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Language toggle — dropdown in the site header. Persists the choice
 * to localStorage; the I18nProvider picks it up on next mount.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Switch language"
          className="text-muted-foreground"
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(LOCALE_LABELS) as Locale[]).map((key) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setLocale(key)}
            className={locale === key ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            {LOCALE_LABELS[key]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
