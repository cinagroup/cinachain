"use client"

import { useEffect, useState } from "react"
import { AlertCircle, BookOpen, Info } from "lucide-react"

import { useAccount } from "wagmi"

import { getBlockExplorerUrl } from "@/config/deployment"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { useCreditBalance } from "@/lib/hooks/use-credit-balance"
import { useI18n } from "@/lib/i18n"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"

const BILLING_API_URL = process.env.NEXT_PUBLIC_BILLING_API_URL ?? ""

/** billing worker GET /v1/credits/:address */
interface LedgerData {
  onchainSnapshot?: string
  committedUsage?: string
  usable?: string
  cumulativeSpend?: string
}

const fmt = (wei?: string) =>
  wei === undefined ? "…" : (Number(BigInt(wei)) / 1e18).toLocaleString()

export default function CreditsPage() {
  const { address, isConnected } = useAccount()
  const { creditBalance, totalSupply, isPaused, isLoading, formatBalance } =
    useCreditBalance(address)
  const { t } = useI18n()

  const [ledger, setLedger] = useState<LedgerData | null>(null)
  const [ledgerError, setLedgerError] = useState(false)

  useEffect(() => {
    if (!address || !BILLING_API_URL) return
    setLedger(null)
    setLedgerError(false)
    fetch(`${BILLING_API_URL}/v1/credits/${address}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setLedger((await res.json()) as LedgerData)
      })
      .catch(() => setLedgerError(true))
  }, [address])

  // Contract not configured state
  if (!hasCreditContract) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-screen-ultra px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Billing
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("credits.title")}<span className="text-foreground">.</span>
            </h1>
          </div>
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="size-4" />
            <AlertDescription>
              The credit contract is not configured. Please contact the
              CinaChain team.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-screen-ultra px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Billing
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("credits.title")}<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
              CinaCredit powers API billing and settles marketplace earnings —
              connect your wallet to view your balance.
            </p>
          </div>

          <Card className="max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>{t("action.connectWallet")}</CardTitle>
              <CardDescription>
                Connect your wallet to view your credit balance and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AppKitConnectButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main connected UI
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Billing
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            {t("credits.title")}<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            {t("credits.description")}
          </p>
        </div>

        {/* Paused warning */}
        {isPaused && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Credit operations are currently paused (all transfers, mints and
              burns are frozen). Please check back later.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Balance card */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>{t("credits.yourBalance")}</CardTitle>
              <CardDescription>
                On-chain CinaCredit (CINA-C) held by your wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="font-display text-5xl tracking-tight text-foreground">
                  {isLoading ? "…" : formatBalance(creditBalance)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">credit</p>
              </div>
              {totalSupply !== undefined && (
                <div className="space-y-3 rounded-md border border-border bg-secondary p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("credits.totalSupply")}</span>
                    <span className="font-medium text-foreground">
                      {formatBalance(totalSupply)}
                    </span>
                  </div>
                  <a
                    href={getBlockExplorerUrl("address", CINA_CREDIT_CONTRACT)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline"
                  >
                    View contract on the explorer
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How credits work card (ops-issued model) */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-5" />
                {t("credits.howItWorks")}
              </CardTitle>
              <CardDescription>
                {t("credits.issuedByTeam")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {t("credits.opsIssued")}
                </span>{" "}
                Top-ups are granted by the team to your wallet address — contact
                the CinaChain team to add credit for API usage.
              </p>
              <p>
                <span className="font-medium text-foreground">
                  {t("credits.oneTokenTwoRoles")}
                </span>{" "}
                Your balance is the ceiling for API billing (usage is metered
                server-side and consumes it), and it is also the token in which
                marketplace earnings settle on-chain.
              </p>
              <p>
                <span className="font-medium text-foreground">
                  {t("credits.keepAnEyeOnUsage")}
                </span>{" "}
                API calls reduce the credit available to your address — the
                ledger below shows how much of your on-chain balance is still
                usable.
              </p>
            </CardContent>
          </Card>

          {/* Ledger card (billing worker) */}
          <Card className="shadow-vercel-card md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5" />
                {t("credits.billingLedger")}
              </CardTitle>
              <CardDescription>
                Server-side metering for your address (billing worker)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-sm">
                    Ledger unavailable — the billing service could not be
                    reached.
                  </AlertDescription>
                </Alert>
              ) : (
                <dl className="grid gap-x-12 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="flex justify-between border-b border-border py-2">
                    <dt className="text-muted-foreground">{t("credits.onChainBalance")}</dt>
                    <dd className="font-mono-tech text-xs">
                      {ledger ? fmt(ledger.onchainSnapshot) : "…"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-border py-2">
                    <dt className="text-muted-foreground">{t("credits.committedUsage")}</dt>
                    <dd className="font-mono-tech text-xs">
                      {ledger ? fmt(ledger.committedUsage) : "…"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-border py-2">
                    <dt className="text-muted-foreground">{t("credits.usable")}</dt>
                    <dd className="font-mono-tech text-xs">
                      {ledger ? fmt(ledger.usable) : "…"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-border py-2">
                    <dt className="text-muted-foreground">{t("credits.cumulativeSpend")}</dt>
                    <dd className="font-mono-tech text-xs">
                      {ledger ? fmt(ledger.cumulativeSpend) : "…"}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
