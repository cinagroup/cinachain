"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { writeContract } from "@wagmi/core"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Plus, Trash2, Loader2 } from "lucide-react"

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`

const MINT_BATCH_ABI = [
  {
    name: "mintBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "ids", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "data", type: "bytes" },
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
  const [items, setItems] = useState<MintItem[]>([{ id: "1", amount: "1" }])
  const [isMinting, setIsMinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    if (!address) return

    // 验证输入
    const validItems = items.filter((item) => item.id && item.amount)
    if (validItems.length === 0) {
      setError("Please add at least one item")
      return
    }

    setIsMinting(true)
    setError(null)
    setSuccess(false)

    try {
      const ids = validItems.map((item) => BigInt(item.id))
      const amounts = validItems.map((item) => BigInt(item.amount))

      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: MINT_BATCH_ABI,
        functionName: "mintBatch",
        args: [address, ids, amounts, "0x"],
      })

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint batch")
    } finally {
      setIsMinting(false)
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
              <CardDescription>Connect your wallet to batch mint</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
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
          <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
            Mint multiple token IDs in a single transaction. Perfect for collections with multiple variants.
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Alert Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-[#aaffec] border-[#50e3c2]/20">
              <AlertDescription className="text-sm text-[#29bc9b]">
                Batch mint successful!
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
                <div key={index} className="flex gap-3 items-start">
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
                      onChange={(e) => updateItem(index, "amount", e.target.value)}
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>

              {/* Summary */}
              <div className="rounded-md border border-border bg-secondary p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium text-foreground">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium text-foreground">
                    {items.reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0)}
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : (
                  `Batch Mint ${items.length} Item${items.length > 1 ? "s" : ""}`
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
