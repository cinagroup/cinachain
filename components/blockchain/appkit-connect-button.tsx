"use client"

import dynamic from "next/dynamic"

import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { isAppKitConfigured } from "@/components/providers/appkit-provider"

const AppKitConnectTrigger = dynamic(
  () =>
    import("./appkit-connect-trigger").then(
      (module) => module.AppKitConnectTrigger
    ),
  { ssr: false }
)

/**
 * Localized trigger for AppKit's connect view, rendered client-side only.
 *
 * Using the product's own button keeps its visible label synchronized with
 * CinaChain's locale. The Reown web component falls back to its English
 * label after locale changes in the current static-export setup.
 */
export function AppKitConnectButton({ className }: { className?: string }) {
  const { t } = useI18n()

  if (!isAppKitConfigured) {
    return (
      <Button type="button" variant="blue" className={className} disabled>
        {t("action.connectWallet")} · {t("status.unavailable")}
      </Button>
    )
  }

  return (
    <AppKitConnectTrigger
      className={className}
      label={t("action.connectWallet")}
      loadingLabel={t("action.loading")}
    />
  )
}
