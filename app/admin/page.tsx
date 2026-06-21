"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useReadContract } from "wagmi"
import { getCinaNftContract } from "@/lib/contracts/cina-nft"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TrendingUp, Users, Package, DollarSign } from "lucide-react"

export default function AdminOverviewPage() {
  const contract = getCinaNftContract()

  const { data: totalSupply, isLoading: supplyLoading } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "totalSupply",
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

  const { data: isPaused } = useReadContract({
    address: contract.address,
    abi: [
      {
        name: "paused",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
      },
    ] as const,
    functionName: "paused",
  })

  const stats = [
    {
      title: "Total Minted",
      value: supplyLoading ? "..." : totalSupply?.toString() || "0",
      description: "NFTs minted so far",
      icon: Package,
    },
    {
      title: "Max Supply",
      value: maxSupply?.toString() || "10,000",
      description: "Total NFT collection size",
      icon: TrendingUp,
    },
    {
      title: "Mint Price",
      value: mintPrice ? `${Number(mintPrice) / 1e18} ETH` : "0.05 ETH",
      description: "Price per NFT",
      icon: DollarSign,
    },
    {
      title: "Status",
      value: isPaused ? "Paused" : "Active",
      description: isPaused ? "Minting is paused" : "Minting is active",
      icon: Users,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Administration
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Admin Dashboard<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
            Overview of your NFT collection and minting statistics.
          </p>
        </div>

        {/* Alert */}
        {isPaused && (
          <Alert variant="destructive" className="mb-8 shadow-vercel-sm">
            <AlertDescription>
              ⚠️ Minting is currently paused. Users cannot mint new NFTs.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title} className="shadow-vercel-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl text-foreground">{stat.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions */}
        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Manage Whitelist</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Upload CSV files and manage whitelist addresses
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">View Statistics</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Detailed minting analytics and revenue tracking
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Contract Settings</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Pause/unpause minting, update prices, withdraw funds
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
