"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Pause, Play, DollarSign, AlertCircle } from "lucide-react"
import { useWriteContract, useReadContract } from "wagmi"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`

const ADMIN_ABI = [
  {
    name: "pause",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "unpause",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "setMintPrice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPrice", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "setBaseURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newBaseURI", type: "string" }],
    outputs: [],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

export default function ContractManagementPage() {
  const { data: isPaused } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ADMIN_ABI,
    functionName: "paused",
  })

  const { writeContract: pause, isPending: isPausing } = useWriteContract()
  const { writeContract: unpause, isPending: isUnpausing } = useWriteContract()
  const { writeContract: withdraw, isPending: isWithdrawing } = useWriteContract()

  const handlePause = () => {
    pause({
      address: CONTRACT_ADDRESS,
      abi: ADMIN_ABI,
      functionName: "pause",
    })
  }

  const handleUnpause = () => {
    unpause({
      address: CONTRACT_ADDRESS,
      abi: ADMIN_ABI,
      functionName: "unpause",
    })
  }

  const handleWithdraw = () => {
    withdraw({
      address: CONTRACT_ADDRESS,
      abi: ADMIN_ABI,
      functionName: "withdraw",
    })
  }

  return (
    <div className="min-h-screen bg-background">
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

        {isPaused && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Minting is currently paused. Users cannot mint new NFTs.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 mt-6 md:grid-cols-2">
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                Minting Status
              </CardTitle>
              <CardDescription>
                Pause or resume the minting process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                <span className="font-medium">Current Status:</span>
                <span className={isPaused ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                  {isPaused ? "Paused" : "Active"}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={isPaused ? handleUnpause : handlePause}
                  disabled={isPausing || isUnpausing}
                  variant={isPaused ? "default" : "destructive"}
                  className="flex-1"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Minting
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Minting
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Withdraw Funds
              </CardTitle>
              <CardDescription>
                Withdraw collected ETH from the contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertDescription>
                  This will transfer all ETH in the contract to the owner address.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                variant="outline"
                className="w-full"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {isWithdrawing ? "Withdrawing..." : "Withdraw All Funds"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contract Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <dt className="text-muted-foreground">Contract Address</dt>
                <dd className="font-mono-tech text-xs">{CONTRACT_ADDRESS}</dd>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <dt className="text-muted-foreground">Network</dt>
                <dd className="font-medium">Ethereum Mainnet</dd>
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
          <AlertDescription>
            <strong>Warning:</strong> These actions require the owner wallet to be connected.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
