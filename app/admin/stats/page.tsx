"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useReadContract } from "wagmi"
import { parseEther } from "viem"
import { getCinaNftContract } from "@/lib/contracts/cina-nft"
import { TrendingUp, Package, DollarSign, Users } from "lucide-react"

export default function StatsPage() {
  const contract = getCinaNftContract()

  const { data: totalSupply, isLoading: supplyLoading } = useReadContract({
    address: contract.address,
    abi: [
      {
        name: "totalSupply",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "totalSupply",
  })

  const { data: mintPrice } = useReadContract({
    address: contract.address,
    abi: [
      {
        name: "mintPrice",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "mintPrice",
  })

  const { data: maxSupply } = useReadContract({
    address: contract.address,
    abi: [
      {
        name: "maxSupply",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "maxSupply",
  })

  // Calculate stats
  const minted = Number(totalSupply || 0)
  const max = Number(maxSupply || 10000)
  const price = Number(mintPrice || parseEther("0.05")) / 1e18
  const revenue = minted * price
  const progress = (minted / max) * 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minting Statistics</h1>
        <p className="text-muted-foreground mt-1">
          Detailed analytics and revenue tracking for your NFT collection
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Minted</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {supplyLoading ? "..." : minted.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {max.toLocaleString()} total supply
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mint Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{price} ETH</div>
            <p className="text-xs text-muted-foreground mt-1">
              per NFT
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue.toFixed(2)} ETH</div>
            <p className="text-xs text-muted-foreground mt-1">
              collected from minting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              collection completed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Minting Progress</CardTitle>
          <CardDescription>
            Visual representation of collection completion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{minted.toLocaleString()} / {max.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-lg font-semibold">
                  {(max - minted).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-lg font-semibold">{progress.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Revenue</p>
                <p className="text-lg font-semibold">{revenue.toFixed(2)} ETH</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
          <CardDescription>
            Key collection milestones and achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[10, 25, 50, 75, 100].map((milestone) => {
              const milestoneCount = Math.floor(max * (milestone / 100))
              const achieved = minted >= milestoneCount
              return (
                <div
                  key={milestone}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    achieved ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${achieved ? "bg-green-500" : "bg-muted-foreground"}`} />
                    <span className="font-medium">{milestone}% Complete</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {milestoneCount.toLocaleString()} NFTs
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
