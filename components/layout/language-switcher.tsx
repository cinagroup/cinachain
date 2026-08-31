"use client"

import { ChevronDown, Languages } from "lucide-react"

import { LOCALE_OPTIONS, useI18n, type Locale } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Language toggle — dropdown in the site header. Persists the choice
 * to localStorage; the I18nProvider picks it up on next mount.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const current =
    LOCALE_OPTIONS.find((option) => option.code === locale) ?? LOCALE_OPTIONS[1]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`${t("language.switch")}: ${current.nativeLabel}`}
          className="h-9 min-w-16 gap-1.5 px-2 text-muted-foreground"
        >
          <Languages className="size-4" />
          <span className="text-xs font-semibold tracking-wide">
            {current.shortLabel}
          </span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-2">
        <DropdownMenuLabel className="px-2 pb-2 text-xs text-muted-foreground">
          {t("language.select")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          {LOCALE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.code}
              value={option.code}
              className="min-h-10 gap-2 pl-8 pr-2"
            >
              <span className="w-7 text-xs font-semibold text-muted-foreground">
                {option.shortLabel}
              </span>
              <span className="flex-1">{option.nativeLabel}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
