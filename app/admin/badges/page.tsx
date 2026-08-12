"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react"
import type { Address, Hash } from "viem"
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi"

import { EXPLORER_NAME, getBlockExplorerUrl } from "@/config/deployment"
import {
  CINA_ERC1155_CONTRACT,
  hasErc1155Contract,
} from "@/lib/contracts/addresses"
import { BADGE_INFO } from "@/lib/hooks/use-badges"
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

const BADGE_ABI = [
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

export default function AdminBadgesPage() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [recipient, setRecipient] = useState("")
  const [badgeId, setBadgeId] = useState("1")
  const [amount, setAmount] = useState("1")
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { isSuccess: confirmed, isError: reverted } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      query: { enabled: !!txHash },
    })

  const isBusy = isPending || (!!txHash && !confirmed && !reverted)

  // A mined-but-reverted tx must not look like success
  useEffect(() => {
    if (reverted) {
      setError("Transaction reverted on-chain — no badge was minted.")
    }
  }, [reverted])

  const handleMint = async () => {
    setError(null)
    setTxHash(null)

    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setError("Invalid recipient address")
      return
    }
    if (!hasErc1155Contract) {
      setError("Badge contract not configured")
      return
    }

    try {
      const hash = await writeContractAsync({
        address: CINA_ERC1155_CONTRACT,
        abi: BADGE_ABI,
        functionName: "mint",
        args: [recipient as Address, BigInt(badgeId), BigInt(amount)],
      })
      setTxHash(hash)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? "Failed to mint badge")
    }
  }

  if (!hasErc1155Contract) {
    return (
      <div className="container max-w-[1400px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Badge contract not configured. Set
            NEXT_PUBLIC_CINA_ERC1155_CONTRACT.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-[1400px] px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Administration
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Badge management<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Award badges and achievements to community members.
      </p>

      {/* Feedback */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}
      {confirmed && txHash && (
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            Badge minted!{" "}
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
        <Alert className="mt-6 border-[#0070f3]/30 bg-[#0070f3]/10">
          <Loader2 className="size-4 animate-spin text-[#0761d1]" />
          <AlertDescription className="text-sm text-[#0761d1]">
            Transaction submitted. Waiting for confirmation...
          </AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-5" />
            Mint badge
          </CardTitle>
          <CardDescription>Award a badge to a specific address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient address</Label>
            <Input
              id="recipient"
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={isBusy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="badgeId">Badge type</Label>
              <select
                id="badgeId"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-vercel-sm"
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                disabled={isBusy}
              >
                {Object.entries(BADGE_INFO).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.icon} {info.name} (#{id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          <Button
            onClick={handleMint}
            disabled={isBusy || !recipient}
            className="w-full"
            size="lg"
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Award className="mr-2 size-4" />
                Mint badge
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Badge reference */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>Badge types</CardTitle>
          <CardDescription>
            Standard badge types available for minting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(BADGE_INFO).map(([id, info]) => (
              <div
                key={id}
                className="rounded-md border border-border bg-secondary p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {info.name}
                    </p>
                    <p className="text-xs text-muted-foreground">#{id}</p>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {info.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
