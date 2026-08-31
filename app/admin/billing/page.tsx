"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react"
import type { Address, Hash } from "viem"
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"

import { EXPLORER_NAME, getBlockExplorerUrl } from "@/config/deployment"
import {
  CINA_CREDIT_CONTRACT,
  hasCreditContract,
} from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"
import { useCreditBalance } from "@/lib/hooks/use-credit-balance"
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
import { useI18n } from "@/lib/i18n"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL || "https://billing-api.cinachain.com"

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const POSITIVE_INT_RE = /^\d+$/
// Credit is an ERC-20 with 18 decimals: 1 credit = 10^18 wei units
const WEI_PER_CREDIT = 1_000_000_000_000_000_000n

interface LedgerData {
  onchainSnapshot: string
  committedUsage: string
  usable: string
  cumulativeSpend: string
}

export default function BillingManagementPage() {
  const { t } = useI18n()
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const publicClient = usePublicClient()
  const { isPaused, isLoading: creditLoading } = useCreditBalance(address)

  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successAction, setSuccessAction] = useState<string | null>(null)

  // Issue credit inputs
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  // Ledger
  const [ledger, setLedger] = useState<LedgerData | null>(null)
  const [ledgerError, setLedgerError] = useState(false)

  // Tier badge minting (spec §5: platform mints on tier crossing)
  const [adminKey, setAdminKey] = useState("")
  const [pendingList, setPendingList] = useState<
    Array<{
      address: string
      badges: string[]
      cumulativeSpend: string
      custId?: string
    }>
  >([])
  const [isFetchingPending, setIsFetchingPending] = useState(false)
  const [badgeError, setBadgeError] = useState<string | null>(null)

  // Custodial accounts
  const [custId, setCustId] = useState("")
  const [custAmountWei, setCustAmountWei] = useState("")
  const [custMsg, setCustMsg] = useState<string | null>(null)

  const { isSuccess: confirmed, isError: reverted } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      query: { enabled: !!txHash },
    })

  // After a tx confirms, refresh rate/paused (wagmi registers contract
  // reads under these query keys) and re-pull the ledger.
  useEffect(() => {
    if (confirmed) {
      void queryClient.invalidateQueries({ queryKey: ["readContracts"] })
      void refetchLedger()
    }
    if (reverted) {
      // A mined-but-reverted tx must not look successful
      setSuccessAction(null)
    }
  }, [confirmed, reverted, queryClient]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the on-chain + billing ledger for the connected admin address
  const refetchLedger = () => {
    if (!address) return
    setLedgerError(false)
    fetch(`${BILLING_API_URL}/v1/credits/${address}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as LedgerData
        setLedger(data)
      })
      .catch(() => setLedgerError(true))
  }

  useEffect(() => {
    setLedger(null)
    refetchLedger()
  }, [address]) // eslint-disable-line react-hooks/exhaustive-deps

  const isBusy = isPending || (!!txHash && !confirmed && !reverted)

  const runWrite = async (
    functionName: "mintTo" | "pause" | "unpause",
    label: string,
    args?: readonly unknown[]
  ) => {
    setError(null)
    setSuccessAction(null)
    setTxHash(null)

    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName,
        args: args as never,
      })
      setTxHash(hash)
      setSuccessAction(label)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(
        anyErr.shortMessage ??
          anyErr.message ??
          t("admin.actionFailed", { action: label })
      )
    }
  }

  const fetchPending = async () => {
    setIsFetchingPending(true)
    setBadgeError(null)
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/admin/pending-badges`, {
        headers: { "X-Admin-Key": adminKey },
      })
      if (!res.ok) throw new Error(`pending-badges ${res.status}`)
      const body = await res.json()
      setPendingList(body.pending ?? [])
    } catch (err) {
      setBadgeError(
        err instanceof Error ? err.message : t("admin.pendingBadgesLoadFailed")
      )
    } finally {
      setIsFetchingPending(false)
    }
  }

  const BADGE_MINT_ABI = [
    {
      name: "mint",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
  ] as const
  const TIER_IDS: Record<string, bigint> = {
    bronze: 100n,
    silver: 101n,
    gold: 102n,
    diamond: 103n,
    whale: 104n,
  }
  const BADGE_CONTRACT =
    process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT ||
    "0x0a32fc1302bf7765b386de5eae857c26d6c8e0ce"

  const mintPending = async (item: {
    address: string
    badges: string[]
    custId?: string
  }) => {
    setBadgeError(null)
    try {
      if (!publicClient) throw new Error(t("admin.noPublicClient"))
      for (const tier of item.badges) {
        const hash = await writeContractAsync({
          address: BADGE_CONTRACT as Address,
          abi: BADGE_MINT_ABI,
          functionName: "mint",
          args: [item.address as Address, TIER_IDS[tier], 1n],
        })
        // wait for mining before confirming in the ledger (review: gate on receipt)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== "success")
          throw new Error(`mint reverted for ${tier}`)
        const confirmRes = await fetch(
          `${BILLING_API_URL}/v1/admin/badges/${item.address}/${tier}/confirm`,
          {
            method: "POST",
            headers: {
              "X-Admin-Key": adminKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              txHash: hash,
              ...(item.custId ? { custId: item.custId } : {}),
            }),
          }
        )
        if (!confirmRes.ok)
          throw new Error(`confirm failed: ${confirmRes.status}`)
      }
      setSuccessAction(t("admin.tierBadgesMinted"))
      await fetchPending()
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setBadgeError(
        anyErr.shortMessage ?? anyErr.message ?? t("admin.badgeMintFailed")
      )
    }
  }

  const custOperate = async (op: "credit" | "debit") => {
    setBadgeError(null)
    setCustMsg(null)
    try {
      if (!custId || !/^\d+$/.test(custAmountWei))
        throw new Error(t("admin.custodialFieldsRequired"))
      const res = await fetch(`${BILLING_API_URL}/v1/custodial/${op}`, {
        method: "POST",
        headers: {
          "X-Admin-Key": adminKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: custId, amountWei: custAmountWei }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `${op} failed: ${res.status}`)
      setCustMsg(
        t("admin.custodialOperationComplete", {
          operation:
            op === "credit" ? t("admin.credit") : t("admin.debit"),
          balance: String(body.balanceWei),
        })
      )
    } catch (err) {
      setBadgeError(
        err instanceof Error ? err.message : t("admin.custodialOperationFailed")
      )
    }
  }

  if (!hasCreditContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("admin.creditContractNotConfigured")}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-screen-ultra px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {t("admin.title")}
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        {t("admin.billingManagement")}<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        {t("admin.billingManagementDescription")}
      </p>

      {/* Paused warning */}
      {isPaused && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {t("admin.creditPausedWarning")}
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction feedback */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}

      {confirmed && txHash && successAction && (
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            {t("admin.actionSuccessful", { action: successAction })} {" "}
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

      {isBusy && txHash && !confirmed && !reverted && (
        <Alert className="border-link/30 bg-link/10 mt-6">
          <Loader2 className="size-4 animate-spin text-link-deep" />
          <AlertDescription className="text-sm text-link-deep">
            {t("admin.transactionPending")}
          </AlertDescription>
        </Alert>
      )}

      {reverted && txHash && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">
            {t("admin.transactionReverted")} {" "}
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

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Issue Credit */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-5" />
              {t("admin.issueCredit")}
            </CardTitle>
            <CardDescription>
              {t("admin.issueCreditDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="recipient">{t("admin.recipientAddress")}</Label>
              <Input
                id="recipient"
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                disabled={isBusy}
                className="font-mono-tech text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{t("admin.creditAmount")}</Label>
              <Input
                id="amount"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.creditAmountDescription")}
            </p>
            <Button
              onClick={() => {
                if (!ADDRESS_RE.test(recipient)) {
                  setError(
                    t("admin.invalidRecipientDetailed")
                  )
                  return
                }
                if (
                  !POSITIVE_INT_RE.test(amount.trim()) ||
                  BigInt(amount) <= 0n
                ) {
                  setError(t("admin.amountPositiveInteger"))
                  return
                }
                const weiAmount = BigInt(amount) * WEI_PER_CREDIT
                if (
                  !window.confirm(
                    t("admin.issueCreditConfirm", {
                      amount,
                      weiAmount: String(weiAmount),
                      recipient,
                    })
                  )
                ) {
                  return
                }
                void runWrite("mintTo", t("admin.creditIssuance"), [
                  recipient,
                  weiAmount,
                ])
              }}
              disabled={isBusy || !recipient || !amount.trim()}
              variant="outline"
              className="w-full"
            >
              {t("admin.issueCredit")}
            </Button>
          </CardContent>
        </Card>

        {/* Ledger */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5" />
              {t("admin.ledger")}
            </CardTitle>
            <CardDescription>
              {t("admin.ledgerDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ledgerError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="break-all text-sm">
                  {t("admin.ledgerUnavailable")}
                </AlertDescription>
              </Alert>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">{t("credits.onChainBalance")}</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.onchainSnapshot : "…"}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">{t("credits.committedUsage")}</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.committedUsage : "…"}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">{t("credits.usable")}</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.usable : "…"}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">{t("credits.cumulativeSpend")}</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.cumulativeSpend : "…"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Emergency Controls */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5" />
              {t("admin.emergencyControls")}
            </CardTitle>
            <CardDescription>
              {t("admin.emergencyControlsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-4">
              <span className="text-sm font-medium">{t("admin.creditOperations")}</span>
              <span
                className={
                  isPaused
                    ? "font-semibold text-red-500"
                    : "font-semibold text-green-500"
                }
              >
                {creditLoading
                  ? "…"
                  : isPaused
                    ? t("admin.paused")
                    : t("admin.active")}
              </span>
            </div>
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    t("admin.pauseCreditConfirm")
                  )
                ) {
                  void runWrite("pause", t("admin.pauseCreditOperations"))
                }
              }}
              disabled={isBusy}
              variant={isPaused ? "default" : "destructive"}
              className="w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Pause className="mr-2 size-4" />
              )}
              {t("admin.pauseCreditOperations")}
            </Button>
            <Button
              onClick={() => {
                if (window.confirm(t("admin.resumeCreditConfirm"))) {
                  void runWrite("unpause", t("admin.resumeCreditOperations"))
                }
              }}
              disabled={isBusy}
              variant="outline"
              className="w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              {t("admin.resumeCreditOperations")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tier badge minting (spec §5: platform mints on tier crossing) */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5" />
            {t("admin.tierBadgeMinting")}
          </CardTitle>
          <CardDescription>
            {t("admin.tierBadgeMintingDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              placeholder={t("admin.adminKey")}
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="max-w-[240px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPending}
              disabled={isFetchingPending}
            >
              {isFetchingPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("admin.refresh")
              )}
            </Button>
          </div>
          {badgeError && (
            <p className="mt-3 text-sm text-destructive">{badgeError}</p>
          )}
          {pendingList.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {isFetchingPending
                ? t("action.loading")
                : t("admin.noPendingTierBadges")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingList.map((item) => (
                <li
                  key={`${item.custId ?? item.address}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-mono-tech text-xs text-foreground">
                      {item.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.tierBadgeCumulative", {
                        badges: item.badges.join(", "),
                        amount: (
                          Number(item.cumulativeSpend) / 1e18
                        ).toLocaleString(),
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => mintPending(item)}
                    disabled={isBusy || !adminKey}
                  >
                    {t("action.mint")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Custodial accounts (spec §6.1: pool + DB bookkeeping) */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="size-5" />
            {t("admin.custodialAccounts")}
          </CardTitle>
          <CardDescription>
            {t("admin.custodialAccountsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custId">{t("admin.accountId")}</Label>
              <Input
                id="custId"
                placeholder="cust_..."
                value={custId}
                onChange={(e) => setCustId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custAmount">{t("admin.amountWei")}</Label>
              <Input
                id="custAmount"
                placeholder="1000000000000000000"
                value={custAmountWei}
                onChange={(e) => setCustAmountWei(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => custOperate("credit")}
              disabled={!adminKey}
            >
              {t("admin.credit")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => custOperate("debit")}
              disabled={!adminKey}
            >
              {t("admin.debit")}
            </Button>
          </div>
          {custMsg && <p className="mt-3 text-sm text-success">{custMsg}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
