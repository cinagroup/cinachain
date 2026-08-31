"use client"

import { useI18n } from "@/lib/i18n"

export function IntegrationWorkbenchLoading() {
  const { t } = useI18n()

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-24 items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      <span>{t("action.loading")}</span>
    </div>
  )
}
