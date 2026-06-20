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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your NFT collection and minting statistics
        </p>
      </div>

      {isPaused && (
        <Alert variant="destructive">
          <AlertDescription>
            ⚠️ Minting is currently paused. Users cannot mint new NFTs.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="font-semibold">Manage Whitelist</h3>
            <p className="text-sm text-muted-foreground">
              Upload CSV files and manage whitelist addresses
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">View Statistics</h3>
            <p className="text-sm text-muted-foreground">
              Detailed minting analytics and revenue tracking
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Contract Settings</h3>
            <p className="text-sm text-muted-foreground">
              Pause/unpause minting, update prices, withdraw funds
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
