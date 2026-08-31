"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { useAccount } from "wagmi"

import { EXPLORER_NAME, getBlockExplorerUrl } from "@/config/deployment"
import { hasMegaContract } from "@/lib/contracts/addresses"
import {
  formatAmount,
  MEGA_COLLECTION_INFO,
  MEGA_RATE_TEXT,
  MEGA_TYPES,
} from "@/lib/exchange"
import { useAccountType } from "@/lib/hooks/use-account-type"
import { useCinaMegaBalances, useCinaMegaMeta } from "@/lib/hooks/use-cina-mega"
import { useMintUcina } from "@/lib/hooks/use-mint-ucina"
import { getMegaTypeImageSources } from "@/lib/mega-media"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"
import { useI18n } from "@/lib/i18n"

function CollectionCard({
  type,
  balance,
  cid,
}: {
  type: number
  balance: bigint
  cid: string
}) {
  const { t } = useI18n()
  const info = MEGA_COLLECTION_INFO[type]
  const sources = getMegaTypeImageSources(cid, type)
  // Chain reads resolve asynchronously (wagmi query hydration): the SSR
  // render sees an empty cid and renders the placeholder div. Without this
  // gate the client's first render (hydrated cache) would emit <img> where
  // the server emitted <div> — a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const showImage = mounted && !!cid
  return (
    <Card className="overflow-hidden shadow-vercel-card">
      <div
        className="relative aspect-square w-full"
        style={{
          background: `linear-gradient(135deg, ${info.color}22, transparent)`,
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sources[0]}
            alt={info.name}
            className="size-full object-cover"
            onError={(e) => {
              const next =
                sources.indexOf((e.currentTarget as HTMLImageElement).src) + 1
              if (next < sources.length)
                (e.currentTarget as HTMLImageElement).src = sources[next]
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-6xl opacity-40">
            {info.icon}
          </div>
        )}
        <span
          className="font-mono-tech absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: `${info.color}22`, color: info.color }}
        >
          {info.units}
        </span>
      </div>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <span>{info.icon}</span> {info.name}
          </CardTitle>
          <span className="font-mono-tech text-sm text-muted-foreground">
            ×{formatAmount(balance)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(`collections.${info.short}Description`)}
        </p>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: `${info.color}1a`, color: info.color }}
        >
          <Sparkles className="size-3.5" />
          {type === 1
            ? t("collections.freePublicMint")
            : t("collections.exchangeOnly")}
        </span>
      </CardContent>
    </Card>
  )
}

export default function CollectionsPage() {
  const { t } = useI18n()
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const { accountType } = useAccountType()
  const { balances, isLoading } = useCinaMegaBalances(address)
  const { cids, mintCapPerAddress, svgLocked, paused } = useCinaMegaMeta()
  const {
    mintUcina,
    status,
    isPending,
    isConfirmed,
    error,
    txHash,
    isGasless,
    reset,
  } = useMintUcina()
  const [amount, setAmount] = useState("100")

  if (!hasMegaContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("exchange.contractNotConfigured")}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const parsedAmount = (() => {
    const n = amount.trim()
    if (!/^\d+$/.test(n)) return 0n
    try {
      return BigInt(n)
    } catch {
      return 0n
    }
  })()

  const handleMint = async () => {
    if (parsedAmount <= 0n) return
    await mintUcina(parsedAmount)
    if (status !== "error") {
      void queryClient.invalidateQueries({ queryKey: ["readContract"] })
      void queryClient.invalidateQueries({ queryKey: ["readContracts"] })
    }
  }

  return (
    <div className="container max-w-screen-ultra px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {t("nav.collections")}
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        CinaMega<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        {t("collections.description")}
      </p>

      {/* Fixed rate card */}
      <div className="font-mono-tech mt-6 rounded-md border border-border bg-secondary p-4 text-sm">
        <span className="font-semibold text-foreground">
          {t("collections.fixedRate")}
        </span>
        <span className="ml-3 text-muted-foreground">{MEGA_RATE_TEXT}</span>
        <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
          {svgLocked ? (
            <>
              <LockKeyhole aria-hidden="true" className="size-3" />
              {t("collections.templatesLocked")}
            </>
          ) : (
            t("collections.templatesPending")
          )}
        </span>
      </div>

      {/* Feedback */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}
      {isConfirmed && txHash && (
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            {t("collections.minted")} {" "}
            <a
              href={getBlockExplorerUrl("tx", txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              {t("common.viewOn", { explorer: EXPLORER_NAME })}{" "}
              <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Counterfactual smart account warning (Attachment-1 adoption) */}
      {accountType === "sa" && (
        <Alert variant="warning" className="mt-6">
          <TriangleAlert className="size-4" />
          <AlertDescription>
            {t("collections.smartAccountNotice")}
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MEGA_TYPES.map((t) => (
          <CollectionCard
            key={t}
            type={t}
            balance={balances[t] ?? 0n}
            cid={cids[t] ?? ""}
          />
        ))}
      </div>

      {/* Free ucina mint */}
      <Card className="mt-8 max-w-md shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            {t("collections.mintUcina")}
            {isGasless && (
              <span className="font-mono-tech bg-cyan/20 rounded-full px-2 py-0.5 text-xs text-cyan-deep">
                {t("common.gasless")}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {t("collections.freeMintDescription")}
            {mintCapPerAddress !== null && (
              <>
                {" "}—{" "}
                {t("collections.perAddressCap", {
                  amount: formatAmount(mintCapPerAddress),
                })}
              </>
            )}
            {paused && (
              <span className="text-destructive">
                {" "}· {t("collections.mintingPaused")}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mint-amount">{t("exchange.amount")}</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setAmount((a) =>
                    BigInt(a || 1) > 1n ? String(BigInt(a) - 1n) : "1"
                  )
                }
                disabled={isPending}
                aria-label={t("collections.decreaseAmount")}
              >
                <Minus className="size-4" />
              </Button>
              <Input
                id="mint-amount"
                type="number"
                min="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setAmount((a) => String((BigInt(a || 1) + 1n).toString()))
                }
                disabled={isPending}
                aria-label={t("collections.increaseAmount")}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {!address ? (
            <AppKitConnectButton className="w-full" />
          ) : (
            <Button
              size="lg"
              className="w-full"
              disabled={isPending || parsedAmount <= 0n || !!paused}
              onClick={handleMint}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("mint.minting")}
                </>
              ) : (
                <>
                  {t("collections.mintAmount", {
                    amount: formatAmount(parsedAmount),
                  })}
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {t("collections.exchangePrompt")} {" "}
            <a href="/exchange" className="underline">
              {t("collections.exchangePage")}
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
