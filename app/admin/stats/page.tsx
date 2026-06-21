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
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Administration
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          Minting Statistics<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
          Detailed analytics and revenue tracking for your NFT collection.
        </p>

        <div className="grid gap-4 mt-8 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Minted</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">
                {supplyLoading ? "..." : minted.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                of {max.toLocaleString()} total supply
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mint Price</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">{price} ETH</div>
              <p className="text-xs text-muted-foreground mt-1">
                per NFT
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">{revenue.toFixed(2)} ETH</div>
              <p className="text-xs text-muted-foreground mt-1">
                collected from minting
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-vercel-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl text-foreground">{progress.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                collection completed
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 shadow-vercel-card">
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
                  <p className="font-display text-lg text-foreground">
                    {(max - minted).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completion</p>
                  <p className="font-display text-lg text-foreground">{progress.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Revenue</p>
                  <p className="font-display text-lg text-foreground">{revenue.toFixed(2)} ETH</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 shadow-vercel-card">
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
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      achieved ? "bg-[#aaffec]/30 border-[#50e3c2]/30" : "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${achieved ? "bg-[#50e3c2]" : "bg-muted-foreground"}`} />
                      <span className="font-medium text-foreground">{milestone}% Complete</span>
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
    </div>
  )
}
