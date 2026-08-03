"use client"

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
import { useMintContract } from "@/lib/hooks/use-mint-contract"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { CheckCircle2, ExternalLink, AlertCircle, Loader2 } from "lucide-react"
import { MINT_PRICE_ETH } from "@/lib/contracts/addresses"

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const {
    data: whitelistData,
    isLoading: whitelistLoading,
    isError: whitelistError,
  } = useWhitelist(address)
  const { paused } = useContractStats()
  const isPaused = paused?.data === true

  const [quantity, setQuantity] = useState(1)
  const [mintPhase, setMintPhase] = useState<"whitelist" | "public" | "inactive">("inactive")

  const {
    mintWhitelist,
    mintPublic,
    status,
    isPending,
    isConfirmed,
    error,
    txHash,
    reset,
    isGasless,
  } = useMintContract()

  useEffect(() => {
    // Contract paused overrides everything
    if (isPaused) {
      setMintPhase("inactive")
      return
    }
    if (!whitelistData) return
    if (whitelistData.eligible) {
      setMintPhase("whitelist")
    } else if (whitelistData.phase === "public") {
      setMintPhase("public")
    } else {
      setMintPhase("inactive")
    }
  }, [whitelistData, isPaused])

  // After successful mint: reset quantity + invalidate queries
  useEffect(() => {
    if (isConfirmed) {
      setQuantity(1)
      queryClient.invalidateQueries({ queryKey: ["whitelist"] })
      queryClient.invalidateQueries({ queryKey: ["nft-balance"] })
      queryClient.invalidateQueries({ queryKey: ["contract-stats"] })
    }
  }, [isConfirmed, queryClient])

  const handleMint = async () => {
    if (quantity < 1) return
    reset()

    if (mintPhase === "whitelist" && whitelistData?.proof) {
      await mintWhitelist(whitelistData.proof, quantity)
    } else if (mintPhase === "public") {
      await mintPublic(quantity)
    }
  }

  const buttonLabel = (() => {
    if (status === "awaiting-wallet") return "Confirm in wallet..."
    if (status === "submitted") return "Confirming..."
    if (isPending) return "Minting..."
    return `Mint ${quantity} NFT${quantity > 1 ? "s" : ""}`
  })()

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
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking mint status...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Error fetching whitelist
  if (whitelistError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-[1200px] px-6 py-12">
          <Card className="max-w-md shadow-vercel-card">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load mint status. The whitelist service may be temporarily unavailable.
                </AlertDescription>
              </Alert>
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
              <CardTitle className="flex items-center gap-2">
                Mint Details
                {isGasless && (
                  <span className="rounded-full bg-[#50e3c2]/20 px-2 py-0.5 text-[10px] font-semibold text-[#29bc9b]">
                    ⚡ Gasless
                  </span>
                )}
              </CardTitle>
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
                    Public mint active. Price:{" "}
                    <span className="font-semibold">{MINT_PRICE_ETH} ETH</span> per NFT.
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

              {/* Transaction feedback */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm break-all">{error}</AlertDescription>
                </Alert>
              )}

              {isConfirmed && txHash && (
                <Alert className="bg-[#aaffec] border-[#50e3c2]/20">
                  <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
                  <AlertDescription className="text-sm text-[#29bc9b]">
                    Mint successful!{" "}
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
                      max={
                        mintPhase === "whitelist"
                          ? whitelistData?.mintLimit || 1
                          : 10
                      }
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="h-10"
                      disabled={isPending}
                    />
                  </div>

                  {/* Price Summary */}
                  <div className="rounded-md border border-border bg-secondary p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price per NFT</span>
                      <span className="font-medium text-foreground">
                        {MINT_PRICE_ETH} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium text-foreground">{quantity}</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-display text-lg text-foreground">
                        {(MINT_PRICE_ETH * quantity).toFixed(2)} ETH
                      </span>
                    </div>
                  </div>

                  {/* Mint Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleMint}
                    disabled={isPending || quantity < 1 || status === "awaiting-wallet"}
                  >
                    {isPending && status === "awaiting-wallet" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {buttonLabel}
                      </>
                    ) : isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {buttonLabel}
                      </>
                    ) : (
                      buttonLabel
                    )}
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
