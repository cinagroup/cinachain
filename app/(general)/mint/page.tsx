"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
import { useMintContract } from "@/lib/hooks/use-mint-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: whitelistData, isLoading: whitelistLoading } = useWhitelist(address)
  const [quantity, setQuantity] = useState(1)
  const [mintPhase, setMintPhase] = useState<"whitelist" | "public" | "inactive">("inactive")

  const { mintWhitelist, mintWhitelistLoading, mintPublic, mintPublicLoading } = useMintContract()

  useEffect(() => {
    if (!whitelistData) return
    
    if (whitelistData.eligible) {
      setMintPhase("whitelist")
    } else if (whitelistData.mintLimit === 0) {
      setMintPhase("public")
    } else {
      setMintPhase("inactive")
    }
  }, [whitelistData])

  const handleMint = () => {
    if (mintPhase === "whitelist" && whitelistData?.proof) {
      mintWhitelist(whitelistData.proof, quantity)
    } else if (mintPhase === "public") {
      mintPublic(quantity)
    }
  }

  const isMinting = mintWhitelistLoading || mintPublicLoading

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-[1200px] px-6 py-12">
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Mint
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Mint CinaChain NFT<span className="text-foreground">.</span>
            </h1>
          </div>

          <Card className="max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>Connect your wallet to mint</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading state
  if (whitelistLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-[1200px] px-6 py-12">
          <Card className="max-w-md shadow-vercel-card">
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground">
                Checking whitelist status...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main mint UI
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Mint
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Mint CinaChain NFT<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
            {mintPhase === "whitelist" && "Exclusive whitelist minting is now active."}
            {mintPhase === "public" && "Public minting is now open to everyone."}
            {mintPhase === "inactive" && "Minting is not currently active."}
          </p>
        </div>

        <div className="max-w-md">
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>Mint Details</CardTitle>
              <CardDescription>
                {mintPhase === "whitelist" && "Whitelist mint active"}
                {mintPhase === "public" && "Public mint active"}
                {mintPhase === "inactive" && "Mint not active"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Alerts */}
              {mintPhase === "whitelist" && whitelistData && (
                <Alert className="bg-[#d3e5ff] border-[#0070f3]/20">
                  <AlertDescription className="text-sm text-[#0761d1]">
                    You are on the whitelist! You can mint up to{" "}
                    <span className="font-semibold">{whitelistData.mintLimit}</span> NFTs.
                  </AlertDescription>
                </Alert>
              )}

              {mintPhase === "public" && (
                <Alert className="bg-[#aaffec] border-[#50e3c2]/20">
                  <AlertDescription className="text-sm text-[#29bc9b]">
                    Public mint active. Price: <span className="font-semibold">0.05 ETH</span> per NFT.
                  </AlertDescription>
                </Alert>
              )}

              {mintPhase === "inactive" && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Minting is not currently active. Please check back later.
                  </AlertDescription>
                </Alert>
              )}

              {/* Mint Form */}
              {mintPhase !== "inactive" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-sm font-medium text-foreground">
                      Quantity
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={mintPhase === "whitelist" ? whitelistData?.mintLimit || 1 : 10}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="h-10"
                    />
                  </div>

                  {/* Price Summary */}
                  <div className="rounded-md border border-border bg-secondary p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price per NFT</span>
                      <span className="font-medium text-foreground">0.05 ETH</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium text-foreground">{quantity}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-display text-lg text-foreground">
                        {(0.05 * quantity).toFixed(2)} ETH
                      </span>
                    </div>
                  </div>

                  {/* Mint Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleMint}
                    disabled={isMinting || quantity < 1}
                  >
                    {isMinting ? "Minting..." : `Mint ${quantity} NFT${quantity > 1 ? "s" : ""}`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
