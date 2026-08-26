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
      setError(anyErr.shortMessage ?? anyErr.message ?? `Failed to ${label}`)
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
        err instanceof Error ? err.message : "Failed to load pending badges"
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
      if (!publicClient) throw new Error("No public client available")
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
      setSuccessAction("Tier badges minted")
      await fetchPending()
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setBadgeError(
        anyErr.shortMessage ?? anyErr.message ?? "Failed to mint badge"
      )
    }
  }

  const custOperate = async (op: "credit" | "debit") => {
    setBadgeError(null)
    setCustMsg(null)
    try {
      if (!custId || !/^\d+$/.test(custAmountWei))
        throw new Error("Valid account id and amountWei required")
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
      setCustMsg(`${op} ok — balanceWei ${String(body.balanceWei)}`)
    } catch (err) {
      setBadgeError(
        err instanceof Error ? err.message : "Custodial operation failed"
      )
    }
  }

  if (!hasCreditContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Credit contract address not configured. Set
            NEXT_PUBLIC_CINA_CREDIT_CONTRACT in environment.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-screen-ultra px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Administration
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Billing management<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Issue CinaCredit (ops-issued model), inspect the ledger, and control
        emergency credit operations.
      </p>

      {/* Paused warning */}
      {isPaused && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Credit operations are currently paused — all CinaCredit transfers,
            mints and burns are frozen on-chain.
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
            {successAction} successful!{" "}
            <a
              href={getBlockExplorerUrl("tx", txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              View on {EXPLORER_NAME} <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {isBusy && txHash && !confirmed && !reverted && (
        <Alert className="border-link/30 bg-link/10 mt-6">
          <Loader2 className="size-4 animate-spin text-link-deep" />
          <AlertDescription className="text-sm text-link-deep">
            Transaction submitted. Waiting for confirmation...
          </AlertDescription>
        </Alert>
      )}

      {reverted && txHash && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">
            Transaction reverted on-chain — the action failed.{" "}
            <a
              href={getBlockExplorerUrl("tx", txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              View on {EXPLORER_NAME} <ExternalLink className="size-3" />
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
              Issue credit
            </CardTitle>
            <CardDescription>
              Mint CinaCredit directly to a recipient address (MINTER_ROLE)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient address</Label>
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
              <Label htmlFor="amount">Amount (credit)</Label>
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
              Amount in credit (1 credit = 10^18 wei units)
            </p>
            <Button
              onClick={() => {
                if (!ADDRESS_RE.test(recipient)) {
                  setError(
                    "Invalid recipient address — must be 0x + 40 hex characters"
                  )
                  return
                }
                if (
                  !POSITIVE_INT_RE.test(amount.trim()) ||
                  BigInt(amount) <= 0n
                ) {
                  setError("Amount must be a positive integer")
                  return
                }
                const weiAmount = BigInt(amount) * WEI_PER_CREDIT
                if (
                  !window.confirm(
                    `Issue ${amount} credit (${weiAmount} wei units) to ${recipient}?`
                  )
                ) {
                  return
                }
                void runWrite("mintTo", "Credit issuance", [
                  recipient,
                  weiAmount,
                ])
              }}
              disabled={isBusy || !recipient || !amount.trim()}
              variant="outline"
              className="w-full"
            >
              Issue credit
            </Button>
          </CardContent>
        </Card>

        {/* Ledger */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5" />
              Ledger
            </CardTitle>
            <CardDescription>
              Credit ledger for the connected admin address
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ledgerError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="break-all text-sm">
                  Ledger unavailable
                </AlertDescription>
              </Alert>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">On-chain snapshot</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.onchainSnapshot : "…"}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">Committed usage</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.committedUsage : "…"}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">Usable</dt>
                  <dd className="font-mono-tech break-all text-xs">
                    {ledger ? ledger.usable : "…"}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Cumulative spend</dt>
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
              Emergency controls
            </CardTitle>
            <CardDescription>
              Pause or resume all on-chain credit operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary p-4">
              <span className="text-sm font-medium">Credit operations</span>
              <span
                className={
                  isPaused
                    ? "font-semibold text-red-500"
                    : "font-semibold text-green-500"
                }
              >
                {creditLoading ? "…" : isPaused ? "Paused" : "Active"}
              </span>
            </div>
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Pause all CinaCredit operations? Transfers, mints and burns freeze on-chain."
                  )
                ) {
                  void runWrite("pause", "Pause credit operations")
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
              Pause credit operations
            </Button>
            <Button
              onClick={() => {
                if (window.confirm("Resume credit operations?")) {
                  void runWrite("unpause", "Resume credit operations")
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
              Resume credit operations
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tier badge minting (spec §5: platform mints on tier crossing) */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5" />
            Tier badge minting
          </CardTitle>
          <CardDescription>
            Addresses that crossed a tier threshold but have no on-chain badge
            yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Admin key"
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
                "Refresh"
              )}
            </Button>
          </div>
          {badgeError && (
            <p className="mt-3 text-sm text-destructive">{badgeError}</p>
          )}
          {pendingList.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {isFetchingPending ? "Loading..." : "No pending tier badges"}
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
                      {item.badges.join(", ")} · cumulative{" "}
                      {(Number(item.cumulativeSpend) / 1e18).toLocaleString()}{" "}
                      credit
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => mintPending(item)}
                    disabled={isBusy || !adminKey}
                  >
                    Mint
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
            Custodial accounts
          </CardTitle>
          <CardDescription>
            DB bookkeeping on top of the hot-wallet pool — credit on deposit,
            debit after pool withdrawal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custId">Account ID</Label>
              <Input
                id="custId"
                placeholder="cust_..."
                value={custId}
                onChange={(e) => setCustId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custAmount">Amount (wei)</Label>
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
              Credit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => custOperate("debit")}
              disabled={!adminKey}
            >
              Debit
            </Button>
          </div>
          {custMsg && <p className="mt-3 text-sm text-success">{custMsg}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
