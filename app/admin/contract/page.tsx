"use client"

import { useState } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, type Hash } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pause, Play, DollarSign, AlertCircle, Settings, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { useContractStats } from "@/lib/hooks/use-contract-stats"

export default function ContractManagementPage() {
  const { paused } = useContractStats()
  const isPaused = paused.data === true

  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successAction, setSuccessAction] = useState<string | null>(null)

  // New price & baseURI inputs
  const [newPriceEth, setNewPriceEth] = useState("")
  const [newBaseURI, setNewBaseURI] = useState("")

  const { isSuccess: confirmed, isError: reverted } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      query: { enabled: !!txHash },
    })

  const isBusy = isPending || (!!txHash && !confirmed && !reverted)

  const handleAction = async (
    functionName: "pause" | "unpause" | "withdraw" | "setMintPrice" | "setBaseURI",
    label: string,
    args?: readonly unknown[],
    value?: bigint
  ) => {
    setError(null)
    setSuccessAction(null)
    setTxHash(null)

    try {
      const hash = await writeContractAsync({
        address: CINA_NFT_CONTRACT,
        abi: [
          {
            name: functionName,
            type: "function",
            stateMutability: value !== undefined ? "payable" : "nonpayable",
            inputs: args
              ? args.map((_, i) => ({
                  name: `arg${i}`,
                  type:
                    typeof args[i] === "bigint"
                      ? "uint256"
                      : "string",
                }))
              : [],
            outputs: [],
          },
        ] as const,
        functionName,
        args: args as never,
        value,
      })
      setTxHash(hash)
      setSuccessAction(label)
    } catch (err) {
      const anyErr = err as unknown as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? `Failed to ${label}`)
    }
  }

  if (!hasNftContract) {
    return (
      <div className="container max-w-[1200px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            NFT contract address not configured. Set NEXT_PUBLIC_CINA_NFT_CONTRACT in environment.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-[1200px] px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Administration
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Contract Management<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
        Manage your NFT contract settings and operations.
      </p>

      {/* Paused warning */}
      {isPaused && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Minting is currently paused. Users cannot mint new NFTs.
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction feedback */}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}

      {confirmed && txHash && successAction && (
        <Alert className="mt-6 border-[#50e3c2]/30 bg-[#50e3c2]/10">
          <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
          <AlertDescription className="text-sm text-[#29bc9b]">
            {successAction} successful!{" "}
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              View on Etherscan <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {isBusy && txHash && !confirmed && !reverted && (
        <Alert className="mt-6 border-[#0070f3]/30 bg-[#0070f3]/10">
          <Loader2 className="h-4 w-4 animate-spin text-[#0761d1]" />
          <AlertDescription className="text-sm text-[#0761d1]">
            Transaction submitted. Waiting for confirmation...
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 mt-6 md:grid-cols-2">
        {/* Pause/Unpause */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              Minting Status
            </CardTitle>
            <CardDescription>Pause or resume the minting process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-secondary rounded-md">
              <span className="text-sm font-medium">Current Status:</span>
              <span className={isPaused ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                {isPaused ? "Paused" : "Active"}
              </span>
            </div>
            <Button
              onClick={() => handleAction(isPaused ? "unpause" : "pause", isPaused ? "Resume minting" : "Pause minting")}
              disabled={isBusy}
              variant={isPaused ? "default" : "destructive"}
              className="mt-4 w-full"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isPaused ? (
                <Play className="h-4 w-4 mr-2" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              {isPaused ? "Resume Minting" : "Pause Minting"}
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Withdraw Funds
            </CardTitle>
            <CardDescription>Withdraw collected ETH from the contract</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription className="text-sm">
                This will transfer all ETH in the contract to the owner address.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                if (window.confirm("Withdraw ALL ETH from the contract to the owner address? This cannot be undone.")) {
                  handleAction("withdraw", "Withdrawal")
                }
              }}
              disabled={isBusy}
              variant="outline"
              className="w-full"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Withdraw All Funds
            </Button>
          </CardContent>
        </Card>

        {/* Set Mint Price */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Set Mint Price
            </CardTitle>
            <CardDescription>Update the price per NFT in ETH</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="price">New Price (ETH)</Label>
              <Input
                id="price"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.05"
                value={newPriceEth}
                onChange={(e) => setNewPriceEth(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <Button
              onClick={() => {
                const price = parseFloat(newPriceEth)
                if (isNaN(price) || price < 0) {
                  setError("Invalid price")
                  return
                }
                handleAction("setMintPrice", "Price update", [parseEther(newPriceEth)])
              }}
              disabled={isBusy || !newPriceEth}
              variant="outline"
              className="w-full"
            >
              Update Price
            </Button>
          </CardContent>
        </Card>

        {/* Set Base URI */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Set Base URI
            </CardTitle>
            <CardDescription>Update the IPFS base URI for metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="baseuri">New Base URI</Label>
              <Input
                id="baseuri"
                type="text"
                placeholder="ipfs://Qm.../"
                value={newBaseURI}
                onChange={(e) => setNewBaseURI(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <Button
              onClick={() => handleAction("setBaseURI", "Base URI update", [newBaseURI])}
              disabled={isBusy || !newBaseURI}
              variant="outline"
              className="w-full"
            >
              Update Base URI
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contract info */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>Contract Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <dt className="text-muted-foreground">Contract Address</dt>
              <dd className="font-mono-tech text-xs">{CINA_NFT_CONTRACT}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-medium">Base</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <dt className="text-muted-foreground">Token Standard</dt>
              <dd className="font-medium">ERC-721</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Contract Status</dt>
              <dd className={isPaused ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                {isPaused ? "Paused" : "Active"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Warning:</strong> These actions require the owner wallet to be connected. The smart
          contract&apos;s <code className="rounded bg-secondary px-1 text-xs">onlyOwner</code> modifier
          is the authoritative access control.
        </AlertDescription>
      </Alert>
    </div>
  )
}
