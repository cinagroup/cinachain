"use client"

import { useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react"
import type { Hash } from "viem"
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"

import { CINA_ERC1155_CONTRACT } from "@/lib/contracts/addresses"
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

const MINT_BATCH_ABI = [
  {
    name: "mintToAddress",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenIds", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const

interface MintItem {
  id: string
  amount: string
}

export default function BatchMintPage() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync, isPending: writePending } = useWriteContract()
  const [items, setItems] = useState<MintItem[]>([{ id: "1", amount: "1" }])
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { isSuccess: confirmed, isError: reverted } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      query: { enabled: !!txHash },
    })

  const isMinting = writePending || (!!txHash && !confirmed && !reverted)

  const addItem = () => {
    setItems([...items, { id: "", amount: "1" }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof MintItem, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleBatchMint = async () => {
    if (!address) {
      setError("Wallet not connected")
      return
    }

    if (
      !CINA_ERC1155_CONTRACT ||
      CINA_ERC1155_CONTRACT === "0x0000000000000000000000000000000000000000"
    ) {
      setError("ERC1155 contract address not configured")
      return
    }

    // 验证输入
    const validItems = items.filter((item) => item.id && item.amount)
    if (validItems.length === 0) {
      setError("Please add at least one item")
      return
    }

    for (const item of validItems) {
      const id = Number(item.id)
      const amount = Number(item.amount)
      if (!Number.isInteger(id) || id < 0) {
        setError(`Token ID "${item.id}" is invalid`)
        return
      }
      if (!Number.isInteger(amount) || amount < 1) {
        setError(`Amount "${item.amount}" must be a positive integer`)
        return
      }
    }

    setError(null)
    setTxHash(null)

    try {
      const ids = validItems.map((item) => BigInt(item.id))
      const amounts = validItems.map((item) => BigInt(item.amount))

      const hash = await writeContractAsync({
        address: CINA_ERC1155_CONTRACT,
        abi: MINT_BATCH_ABI,
        functionName: "mintToAddress",
        args: [address, ids, amounts],
      })

      setTxHash(hash)
    } catch (err) {
      const anyErr = err as {
        shortMessage?: string
        message?: string
      }
      setError(anyErr.shortMessage ?? anyErr.message ?? "Failed to mint batch")
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-[1200px] px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Batch Mint
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Batch Mint ERC1155<span className="text-foreground">.</span>
            </h1>
          </div>

          <Card className="max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to batch mint
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Batch Mint
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Batch Mint ERC1155<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Mint multiple badge types to your address in a single transaction.
            Perfect for collections with multiple variants.
          </p>
          <p className="mt-2 max-w-[560px] text-sm text-muted-foreground">
            <span className="font-medium">Note:</span> the underlying contract
            function is
            <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
              onlyOwner
            </code>
            — only the contract owner&apos;s wallet can execute this.
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {confirmed && txHash && (
            <Alert className="border-[#50e3c2]/20 bg-[#aaffec]">
              <CheckCircle2 className="size-4 text-[#29bc9b]" />
              <AlertDescription className="text-sm text-[#29bc9b]">
                Batch mint confirmed!{" "}
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

          {/* Pending Message */}
          {isMinting && txHash && !confirmed && !reverted && (
            <Alert className="border-[#0070f3]/20 bg-[#d3e5ff]">
              <Loader2 className="size-4 animate-spin text-[#0761d1]" />
              <AlertDescription className="text-sm text-[#0761d1]">
                Transaction submitted. Waiting for confirmation...
              </AlertDescription>
            </Alert>
          )}

          {reverted && (
            <Alert variant="destructive">
              <AlertDescription>
                Transaction reverted on-chain.
              </AlertDescription>
            </Alert>
          )}

          {/* Mint Items */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>Mint Items</CardTitle>
              <CardDescription>
                Add multiple token IDs and amounts to mint in one transaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`id-${index}`}>Token ID</Label>
                    <Input
                      id={`id-${index}`}
                      type="number"
                      min="0"
                      placeholder="1"
                      value={item.id}
                      onChange={(e) => updateItem(index, "id", e.target.value)}
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label htmlFor={`amount-${index}`}>Amount</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      min="1"
                      placeholder="1"
                      value={item.amount}
                      onChange={(e) =>
                        updateItem(index, "amount", e.target.value)
                      }
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="mt-6"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addItem} className="w-full">
                <Plus className="mr-2 size-4" />
                Add Item
              </Button>

              {/* Summary */}
              <div className="space-y-3 rounded-md border border-border bg-secondary p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium text-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium text-foreground">
                    {items.reduce(
                      (sum, item) => sum + (parseInt(item.amount) || 0),
                      0
                    )}
                  </span>
                </div>
              </div>

              {/* Mint Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleBatchMint}
                disabled={isMinting}
              >
                {isMinting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  `Batch Mint ${items.length} Item${
                    items.length > 1 ? "s" : ""
                  }`
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
