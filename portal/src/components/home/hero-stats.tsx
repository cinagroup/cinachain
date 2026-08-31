import { useI18n } from "@/lib/i18n"

/**
 * Static hero stats bar for the brand portal.
 *
 * The DApp's HeroStats reads live contract data (minted/max counts); the
 * portal is a static site with no contract access, so it shows fixed,
 * factual values instead. Layout + classes mirror the DApp component.
 */
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-6 text-center">
      <dt className="font-mono-tech order-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-display order-1 text-xl text-foreground">{value}</dd>
    </div>
  )
}

export function HeroStats() {
  const { t } = useI18n()

  return (
    <dl className="mx-auto mt-12 flex max-w-screen-sm items-center justify-center divide-x divide-border rounded-lg border border-border bg-card px-2 py-4 shadow-vercel-sm">
      <HeroStat label={t("stats.maxSupply")} value="10,000" />
      <HeroStat label={t("stats.network")} value="Base Sepolia" />
      <HeroStat label={t("stats.stage")} value={t("status.beta")} />
    </dl>
  )
}
