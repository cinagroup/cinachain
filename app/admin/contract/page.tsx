"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Pause, Play, DollarSign, RefreshCw, AlertCircle } from "lucide-react"
import { useWriteContract, useReadContract } from "wagmi"
import { parseEther } from "viem"

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

  const { write: pause, isPending: isPausing } = useWriteContract()
  const { write: unpause, isPending: isUnpausing } = useWriteContract()
  const { write: withdraw, isPending: isWithdrawing } = useWriteContract()

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contract Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage your NFT contract settings and operations
        </p>
      </div>

      {isPaused && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Minting is currently paused. Users cannot mint new NFTs.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="font-medium">Current Status:</span>
                <span className={isPaused ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                  {isPaused ? "Paused" : "Active"}
                </span>
              </div>
              <Button
                onClick={isPaused ? handleUnpause : handlePause}
                disabled={isPausing || isUnpausing}
                variant={isPaused ? "default" : "destructive"}
                className="w-full"
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

        <Card>
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
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will transfer all ETH in the contract to the owner address.
                  Make sure you have access to the owner wallet.
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
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Contract Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Contract Address</span>
              <span className="font-mono text-xs">
                {CONTRACT_ADDRESS?.slice(0, 10)}...{CONTRACT_ADDRESS?.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium">Ethereum Mainnet</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Token Standard</span>
              <span className="font-medium">ERC-721</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Contract Status</span>
              <span className={isPaused ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                {isPaused ? "Paused" : "Active"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> These actions require the owner wallet to be connected. 
          Make sure you are using the correct wallet before executing any transactions.
        </AlertDescription>
      </Alert>
    </div>
  )
}
