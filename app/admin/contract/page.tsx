"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Settings,
  TreePine,
} from "lucide-react"
import { formatUnits, parseEther, type Hash } from "viem"
import {
  useBalance,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"

import {
  EXPLORER_NAME,
  getBlockExplorerUrl,
  PRIMARY_NETWORK_NAME,
} from "@/config/deployment"
import { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
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

export default function ContractManagementPage() {
  const { paused, refetch: refetchStats } = useContractStats()
  const isPaused = paused.data === true

  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successAction, setSuccessAction] = useState<string | null>(null)

  // New price & baseURI inputs
  const [newPriceEth, setNewPriceEth] = useState("")
  const [newBaseURI, setNewBaseURI] = useState("")
  const [newMerkleRoot, setNewMerkleRoot] = useState("")

  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: CINA_NFT_CONTRACT,
    query: { enabled: hasNftContract },
  })

  const { isSuccess: confirmed, isError: reverted } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      query: { enabled: !!txHash },
    })

  // After a tx confirms, refresh on-chain status + contract balance (M3/M4)
  useEffect(() => {
    if (confirmed) {
      void refetchStats()
      void refetchBalance()
    }
    if (reverted) {
      // A mined-but-reverted tx must not look successful
      setSuccessAction(null)
    }
  }, [confirmed, reverted, refetchStats, refetchBalance])

  const isBusy = isPending || (!!txHash && !confirmed && !reverted)

  /** Trim trailing zeros from a formatted balance (e.g. "0.001000" → "0.001") */
  function trimEth(formatted: string): string {
    if (!formatted.includes(".")) return formatted
    return formatted.replace(/\.?0+$/, "")
  }

  const handleAction = async (
    functionName:
      | "pause"
      | "unpause"
      | "withdraw"
      | "setMintPrice"
      | "setBaseURI"
      | "setMerkleRoot",
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
              ? args.map((_, i) => {
                  const v = args[i]
                  if (typeof v === "bigint") {
                    return { name: `arg${i}`, type: "uint256" }
                  }
                  if (typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v)) {
                    return { name: `arg${i}`, type: "bytes32" }
                  }
                  return { name: `arg${i}`, type: "string" }
                })
              : [],
            outputs: [],
          },
        ] as const,
        functionName,
        args: args as never,
        // The ABI is built dynamically (payable only when value is set) —
        // viem can't correlate the two, so loosen the value type explicitly.
        value: value as never,
      })
      setTxHash(hash)
      setSuccessAction(label)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? `Failed to ${label}`)
    }
  }

  if (!hasNftContract) {
    return (
      <div className="container max-w-screen-ultra px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            NFT contract address not configured. Set
            NEXT_PUBLIC_CINA_NFT_CONTRACT in environment.
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
        Contract management<span className="text-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Manage your NFT contract settings and operations.
      </p>

      {/* Paused warning */}
      {isPaused && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Minting is currently paused. Users cannot mint new NFTs.
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
        {/* Pause/Unpause */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isPaused ? (
                <Play className="size-5" />
              ) : (
                <Pause className="size-5" />
              )}
              Minting status
            </CardTitle>
            <CardDescription>
              Pause or resume the minting process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-md bg-secondary p-4">
              <span className="text-sm font-medium">Current status:</span>
              <span
                className={
                  isPaused
                    ? "font-semibold text-red-500"
                    : "font-semibold text-green-500"
                }
              >
                {isPaused ? "Paused" : "Active"}
              </span>
            </div>
            <Button
              onClick={() =>
                handleAction(
                  isPaused ? "unpause" : "pause",
                  isPaused ? "Resume minting" : "Pause minting"
                )
              }
              disabled={isBusy}
              variant={isPaused ? "default" : "destructive"}
              className="mt-4 w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : isPaused ? (
                <Play className="mr-2 size-4" />
              ) : (
                <Pause className="mr-2 size-4" />
              )}
              {isPaused ? "Resume minting" : "Pause minting"}
            </Button>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5" />
              Withdraw funds
            </CardTitle>
            <CardDescription>
              Withdraw collected ETH from the contract
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-secondary p-4">
              <span className="text-sm font-medium">Contract balance</span>
              <span className="font-mono-tech text-sm text-foreground">
                {contractBalance
                  ? `${trimEth(
                      formatUnits(
                        contractBalance.value,
                        contractBalance.decimals
                      )
                    )} ETH`
                  : "—"}
              </span>
            </div>
            <Alert className="mb-4">
              <AlertDescription className="text-sm">
                This will transfer all ETH in the contract to the owner address.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Withdraw ALL ETH from the contract to the owner address? This cannot be undone."
                  )
                ) {
                  void handleAction("withdraw", "Withdrawal")
                }
              }}
              disabled={
                isBusy || !contractBalance || contractBalance.value === 0n
              }
              variant="outline"
              className="w-full"
            >
              {isBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <DollarSign className="mr-2 size-4" />
              )}
              {contractBalance && contractBalance.value === 0n
                ? "Nothing to withdraw"
                : "Withdraw all funds"}
            </Button>
          </CardContent>
        </Card>

        {/* Set Mint Price */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Set mint price
            </CardTitle>
            <CardDescription>Update the price per NFT in ETH</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="price">New price (ETH)</Label>
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
                if (isNaN(price) || price <= 0) {
                  setError("Price must be greater than 0")
                  return
                }
                if (
                  !window.confirm(
                    `Set mint price to ${newPriceEth} ETH per NFT?`
                  )
                ) {
                  return
                }
                void handleAction("setMintPrice", "Price update", [
                  parseEther(newPriceEth),
                ])
              }}
              disabled={isBusy || !newPriceEth}
              variant="outline"
              className="w-full"
            >
              Update price
            </Button>
          </CardContent>
        </Card>

        {/* Set Merkle root */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TreePine className="size-5" />
              Set Merkle root
            </CardTitle>
            <CardDescription>
              Enable whitelist minting with the root from Whitelist management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="merkle-root">Merkle root (0x...)</Label>
              <Input
                id="merkle-root"
                type="text"
                placeholder="0x0000...0000"
                value={newMerkleRoot}
                onChange={(e) => setNewMerkleRoot(e.target.value.trim())}
                disabled={isBusy}
                className="font-mono-tech text-xs"
              />
            </div>
            <Button
              onClick={() => {
                if (!/^0x[0-9a-fA-F]{64}$/.test(newMerkleRoot)) {
                  setError(
                    "Invalid Merkle root — must be 32 bytes (0x + 64 hex chars)"
                  )
                  return
                }
                void handleAction("setMerkleRoot", "Merkle root update", [
                  newMerkleRoot,
                ])
              }}
              disabled={isBusy || !newMerkleRoot}
              variant="outline"
              className="w-full"
            >
              Set Merkle root
            </Button>
          </CardContent>
        </Card>

        {/* Set Base URI */}
        <Card className="shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Set base URI
            </CardTitle>
            <CardDescription>
              Update the IPFS base URI for metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="baseuri">New base URI</Label>
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
              onClick={() =>
                handleAction("setBaseURI", "Base URI update", [newBaseURI])
              }
              disabled={isBusy || !newBaseURI}
              variant="outline"
              className="w-full"
            >
              Update base URI
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contract info */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>Contract information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">Contract address</dt>
              <dd className="font-mono-tech text-xs">{CINA_NFT_CONTRACT}</dd>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-medium">{PRIMARY_NETWORK_NAME}</dd>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground">Token standard</dt>
              <dd className="font-medium">ERC-721</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Contract status</dt>
              <dd
                className={
                  isPaused
                    ? "font-semibold text-red-500"
                    : "font-semibold text-green-500"
                }
              >
                {isPaused ? "Paused" : "Active"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <AlertCircle className="size-4" />
        <AlertDescription className="text-sm">
          <strong>Warning:</strong> These actions require the owner wallet to be
          connected. The smart contract&apos;s{" "}
          <code className="rounded bg-secondary px-1 text-xs">onlyOwner</code>{" "}
          modifier is the authoritative access control.
        </AlertDescription>
      </Alert>
    </div>
  )
}
