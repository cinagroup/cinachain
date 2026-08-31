"use client"

import { useI18n } from "@/lib/i18n"

export function SkipLink() {
  const { t } = useI18n()

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-vercel-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {t("nav.skipToContent")}
    </a>
  )
}
