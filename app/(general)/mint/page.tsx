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

  const { useMintWhitelist, useMintPublic } = useMintContract()
  const { write: mintWhitelist, isLoading: mintWhitelistLoading } = useMintWhitelist(
    whitelistData?.proof || [],
    quantity
  )
  const { write: mintPublic, isLoading: mintPublicLoading } = useMintPublic(quantity)

  useEffect(() => {
    if (!whitelistData) return
    
    if (whitelistData.eligible) {
      setMintPhase("whitelist")
    } else if (whitelistData.mintLimit === 0) {
      // Check if public mint is active (you may want to query contract for this)
      setMintPhase("public")
    } else {
      setMintPhase("inactive")
    }
  }, [whitelistData])

  const handleMint = () => {
    if (mintPhase === "whitelist" && whitelistData?.proof) {
      mintWhitelist?.()
    } else if (mintPhase === "public") {
      mintPublic?.()
    }
  }

  const isMinting = mintWhitelistLoading || mintPublicLoading

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Mint CinaChain NFT</CardTitle>
            <CardDescription>Connect your wallet to mint</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (whitelistLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Checking whitelist status...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Mint CinaChain NFT</CardTitle>
          <CardDescription>
            {mintPhase === "whitelist" && "Whitelist mint active"}
            {mintPhase === "public" && "Public mint active"}
            {mintPhase === "inactive" && "Mint not active"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mintPhase === "whitelist" && whitelistData && (
            <Alert>
              <AlertDescription>
                You are on the whitelist! You can mint up to{" "}
                {whitelistData.mintLimit} NFTs.
              </AlertDescription>
            </Alert>
          )}

          {mintPhase === "public" && (
            <Alert>
              <AlertDescription>
                Public mint active. Price: 0.05 ETH per NFT.
              </AlertDescription>
            </Alert>
          )}

          {mintPhase === "inactive" && (
            <Alert>
              <AlertDescription>
                Minting is not currently active. Please check back later.
              </AlertDescription>
            </Alert>
          )}

          {mintPhase !== "inactive" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={mintPhase === "whitelist" ? whitelistData?.mintLimit || 1 : 10}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Price per NFT</span>
                  <span>0.05 ETH</span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Total</span>
                  <span>{(0.05 * quantity).toFixed(2)} ETH</span>
                </div>
              </div>

              <Button
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
  )
}
