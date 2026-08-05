"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeftRight, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"

import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { hasMegaContract } from "@/lib/contracts/addresses"
import { convertAmount, MEGA_COLLECTION_INFO, MEGA_RATE_TEXT, MEGA_TYPES, MEGA_UNITS, formatAmount } from "@/lib/exchange"
import { useCinaMegaBalances } from "@/lib/hooks/use-cina-mega"
import { useExchange } from "@/lib/hooks/use-exchange"

function TypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (t: number) => void
  disabled?: boolean
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-vercel-sm"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
    >
      {MEGA_TYPES.map((t) => (
        <option key={t} value={t}>
          {MEGA_COLLECTION_INFO[t].icon} {MEGA_COLLECTION_INFO[t].name} ({MEGA_COLLECTION_INFO[t].units})
        </option>
      ))}
    </select>
  )
}

export default function ExchangePage() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const { balances } = useCinaMegaBalances(address)
  const { exchange, status, isPending, isConfirmed, error, txHash, isGasless, reset } = useExchange()

  const [fromType, setFromType] = useState(1)
  const [toType, setToType] = useState(2)
  const [amount, setAmount] = useState("1000")

  if (!hasMegaContract) {
    return (
      <div className="container max-w-[1200px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            CinaMega contract not configured. Set NEXT_PUBLIC_CINA_MEGA_CONTRACT.
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

  const conversion = convertAmount(fromType, toType, parsedAmount)
  const balance = balances[fromType] ?? 0n
  const exceedsBalance = parsedAmount > balance
  const canSubmit =
    !!address &&
    !isPending &&
    conversion.ok &&
    !exceedsBalance &&
    parsedAmount > 0n

  const swapDirection = () => {
    setFromType(toType)
    setToType(fromType)
    reset()
  }

  const handleExchange = async () => {
    if (!canSubmit) return
    await exchange(BigInt(fromType), BigInt(toType), parsedAmount)
    if (status !== "error") {
      void queryClient.invalidateQueries({ queryKey: ["readContract"] })
      void queryClient.invalidateQueries({ queryKey: ["readContracts"] })
    }
  }

  return (
    <div className="container max-w-[1200px] px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Exchange
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Exchange CinaMega<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Convert between UCINA, MCINA and CINA at the fixed rate. Exchanges are atomic — your source
        tokens are burned and the destination minted in the same transaction.
      </p>

      <div className="font-mono-tech mt-6 rounded-md border border-border bg-secondary p-4 text-sm">
        <span className="font-semibold text-foreground">Fixed rate</span>
        <span className="ml-3 text-muted-foreground">{MEGA_RATE_TEXT}</span>
      </div>

      {/* Feedback */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}
      {isConfirmed && txHash && (
        <Alert className="mt-6 border-[#50e3c2]/30 bg-[#50e3c2]/10">
          <CheckCircle2 className="size-4 text-[#29bc9b]" />
          <AlertDescription className="text-sm text-[#29bc9b]">
            Exchange complete!{" "}
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              View on Basescan <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mt-8 max-w-md shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5" />
            Exchange
            {isGasless && (
              <span className="font-mono-tech rounded-full bg-[#50e3c2]/20 px-2 py-0.5 text-xs text-[#29bc9b]">
                ⚡ Gasless
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {address ? (
              <>
                You hold: UCINA {formatAmount(balances[1] ?? 0n)} · MCINA {formatAmount(balances[2] ?? 0n)} ·
                CINA {formatAmount(balances[3] ?? 0n)}
              </>
            ) : (
              "Connect a wallet to exchange"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>You give (source)</Label>
            <TypeSelect value={fromType} onChange={(t) => { setFromType(t); reset() }} disabled={isPending} />
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              placeholder="Amount"
            />
            {exceedsBalance && (
              <p className="text-xs text-destructive">
                Insufficient balance — you hold {formatAmount(balance)} {MEGA_COLLECTION_INFO[fromType].name}
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <Button variant="ghost" size="icon" onClick={swapDirection} disabled={isPending} title="Swap direction">
              <ArrowLeftRight className="size-5 rotate-90" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>You receive (destination)</Label>
            <TypeSelect value={toType} onChange={(t) => { setToType(t); reset() }} disabled={isPending} />
            <div className="rounded-md border border-border bg-secondary p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">You receive</span>
                <span className="font-display text-lg">
                  {conversion.ok
                    ? `${formatAmount(conversion.toAmount)} ${MEGA_COLLECTION_INFO[toType].name}`
                    : conversion.error === "too-small"
                    ? `0 ${MEGA_COLLECTION_INFO[toType].name}`
                    : "—"}
                </span>
              </div>
              {conversion.ok && conversion.dust > 0n && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Dust burned: {formatAmount(conversion.dust)} units (floor conversion)
                </p>
              )}
              {conversion.error === "too-small" && (
                <p className="mt-1 text-xs text-amber-600">
                  Amount too small — minimum for 1 {MEGA_COLLECTION_INFO[toType].name}:{" "}
                  {formatAmount((MEGA_UNITS[toType] + MEGA_UNITS[fromType] - 1n) / MEGA_UNITS[fromType])}{" "}
                  {MEGA_COLLECTION_INFO[fromType].name}
                </p>
              )}
            </div>
          </div>

          {!address ? (
            <AppKitConnectButton className="w-full" />
          ) : (
            <Button size="lg" className="w-full" disabled={!canSubmit} onClick={handleExchange}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Exchanging...
                </>
              ) : (
                <>
                  Exchange{" "}
                  {conversion.ok
                    ? `${formatAmount(parsedAmount)} ${MEGA_COLLECTION_INFO[fromType].name} → ${formatAmount(
                        conversion.toAmount
                      )} ${MEGA_COLLECTION_INFO[toType].name}`
                    : ""}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
