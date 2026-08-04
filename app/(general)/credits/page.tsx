"use client"

import { useEffect, useState } from "react"
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parseEther, type Hash } from "viem"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"

import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
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

const MIN_TOP_UP_ETH = 0.001
const BPS_DIVISOR = 10000n
const VALID_AMOUNT_RE = /^\d*\.?\d+$/

function extractError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as unknown as {
      shortMessage?: string
      cause?: { reason?: string }
    }
    if (anyErr.shortMessage) return anyErr.shortMessage
    if (anyErr.cause?.reason) return anyErr.cause.reason
    return err.message
  }
  return "Unknown error"
}

export default function CreditsPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const {
    creditBalance,
    creditRate,
    feeBps,
    isPaused,
    isLoading,
    ethToCredit,
    formatBalance,
  } = useCreditBalance(address)

  const [ethAmount, setEthAmount] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hash | undefined>(undefined)
  const [confirmed, setConfirmed] = useState(false)

  const { writeContractAsync, isPending } = useWriteContract()
  const {
    isSuccess: txConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  // After a confirmed top-up: clear the form and refresh the balance
  useEffect(() => {
    if (txConfirmed) {
      setConfirmed(true)
      setEthAmount("")
      // wagmi registers contract reads under these prefixes
      queryClient.invalidateQueries({ queryKey: ["readContracts"] })
      queryClient.invalidateQueries({ queryKey: ["balance"] })
    }
  }, [txConfirmed, queryClient])

  const trimmedAmount = ethAmount.trim()
  const ethNum = Number(trimmedAmount)
  const formatValid =
    !!trimmedAmount &&
    VALID_AMOUNT_RE.test(trimmedAmount) &&
    !Number.isNaN(ethNum) &&
    Number.isFinite(ethNum)
  const amountValid = formatValid && ethNum >= MIN_TOP_UP_ETH
  const grossCredit = amountValid ? ethToCredit(ethNum) : 0n
  const fee = grossCredit > 0n && feeBps ? (grossCredit * feeBps) / BPS_DIVISOR : 0n
  const youReceive = grossCredit > fee ? grossCredit - fee : 0n

  const handleTopUp = async () => {
    setLocalError(null)
    setConfirmed(false)
    if (!formatValid) {
      setLocalError("Enter a valid ETH amount (e.g. 0.05)")
      return
    }
    const decimals = trimmedAmount.includes(".")
      ? trimmedAmount.split(".")[1].length
      : 0
    if (decimals > 18) {
      setLocalError("Maximum of 18 decimal places")
      return
    }
    if (ethNum < MIN_TOP_UP_ETH) {
      setLocalError(`Amount must be at least ${MIN_TOP_UP_ETH} ETH`)
      return
    }
    if (isPaused) {
      setLocalError("Top-ups are paused. Please check back later.")
      return
    }
    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName: "mintWithEth",
        value: parseEther(trimmedAmount),
      })
      setTxHash(hash)
    } catch (err) {
      setLocalError(extractError(err))
    }
  }

  // Contract not configured state
  if (!hasCreditContract) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-[1200px] px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Billing
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Credits<span className="text-foreground">.</span>
            </h1>
          </div>
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The credit contract is not configured. Please contact the CinaChain team.
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
        <div className="container max-w-[1200px] px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Billing
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Credits<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
              Top up your credit balance with ETH to pay for on-chain features and
              gasless transactions.
            </p>
          </div>

          <Card className="max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to view your credit balance and top up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main connected UI
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Billing
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Credits<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Top up your credit balance with ETH to pay for on-chain features and
            gasless transactions.
          </p>
        </div>

        {/* Paused warning */}
        {isPaused && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Credit top-ups are currently paused. Please check back later.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Balance card */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>Your Balance</CardTitle>
              <CardDescription>Available CinaCredit for billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="font-display text-5xl tracking-tight text-foreground">
                  {isLoading ? "…" : formatBalance(creditBalance)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">credit</p>
              </div>
              {creditRate !== undefined && (
                <div className="rounded-md border border-border bg-secondary p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Exchange rate</span>
                    <span className="font-medium text-foreground">
                      1 ETH = {formatBalance(creditRate)} credit
                    </span>
                  </div>
                  {feeBps !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform fee</span>
                      <span className="font-medium text-foreground">
                        {(Number(feeBps) / 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Up card */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>Top Up</CardTitle>
              <CardDescription>Mint new credit with ETH</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Transaction feedback */}
              {(localError || receiptError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm break-all">
                    {localError ?? extractError(receiptError)}
                  </AlertDescription>
                </Alert>
              )}

              {confirmed && txHash && (
                <Alert className="bg-[#aaffec] border-[#50e3c2]/20">
                  <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
                  <AlertDescription className="text-sm text-[#29bc9b]">
                    Top-up confirmed! Your credit balance has been updated.{" "}
                    <a
                      href={`https://sepolia.basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      View on Etherscan <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {/* ETH amount */}
              <div className="space-y-2">
                <Label htmlFor="eth-amount" className="text-sm font-medium text-foreground">
                  ETH Amount
                </Label>
                <Input
                  id="eth-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min={MIN_TOP_UP_ETH}
                  placeholder="0.05"
                  value={ethAmount}
                  onChange={(e) => {
                    setEthAmount(e.target.value)
                    setConfirmed(false)
                  }}
                  className="h-10"
                  disabled={isPending}
                />
              </div>

              {/* Top-up summary */}
              <div className="rounded-md border border-border bg-secondary p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross credit</span>
                  <span className="font-medium text-foreground">
                    {amountValid ? formatBalance(grossCredit) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span className="font-medium text-foreground">
                    {feeBps !== undefined ? `${(Number(feeBps) / 100).toFixed(2)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee amount</span>
                  <span className="font-medium text-foreground">
                    {amountValid ? formatBalance(fee) : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">You receive</span>
                  <span className="font-display text-lg text-foreground">
                    {amountValid ? formatBalance(youReceive) : "—"}
                  </span>
                </div>
              </div>

              {/* Top Up button */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleTopUp}
                disabled={isPending || !amountValid || isPaused}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Top Up"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
