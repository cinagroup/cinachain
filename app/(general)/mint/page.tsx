"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react"
import { formatEther } from "viem"
import { useAccount, useReadContracts } from "wagmi"

import { EXPLORER_NAME, getBlockExplorerUrl } from "@/config/deployment"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import {
  CINA_NFT_CONTRACT,
  hasNftContract,
  MINT_PRICE_ETH,
} from "@/lib/contracts/addresses"
import { useContractStats } from "@/lib/hooks/use-contract-stats"
import { useMintContract } from "@/lib/hooks/use-mint-contract"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
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
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"

const MAX_PUBLIC_PER_TX = 10

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()
  const {
    data: whitelistData,
    isLoading: whitelistLoading,
    isError: whitelistError,
  } = useWhitelist(address)
  const { paused, mintPrice } = useContractStats()
  const isPaused = paused?.data === true

  const [quantity, setQuantity] = useState(1)
  const [mintPhase, setMintPhase] = useState<
    "whitelist" | "public" | "inactive"
  >("inactive")
  const [localError, setLocalError] = useState<string | null>(null)

  // Cumulative per-address mint counts (contract caps are cumulative, not per-tx)
  const { data: usageRes } = useReadContracts({
    contracts: [
      {
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "mintedByAddress",
        args: address ? [address] : undefined,
      },
      {
        address: CINA_NFT_CONTRACT,
        abi: CINA_NFT_ABI,
        functionName: "whitelistMintedByAddress",
        args: address ? [address] : undefined,
      },
    ],
    query: { enabled: isConnected && !!address && hasNftContract },
  })
  const mintedPublicCount =
    usageRes?.[0]?.status === "success" ? Number(usageRes[0].result) : 0
  const mintedWhitelistCount =
    usageRes?.[1]?.status === "success" ? Number(usageRes[1].result) : 0
  const publicRemaining = Math.max(0, MAX_PUBLIC_PER_TX - mintedPublicCount)
  const whitelistRemaining = Math.max(
    0,
    (whitelistData?.mintLimit ?? 3) - mintedWhitelistCount
  )

  // True when a whitelist IS deployed but this address isn't on it
  const notWhitelisted =
    !!whitelistData &&
    whitelistData.phase === "whitelist" &&
    !whitelistData.eligible

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
    // Whitelist service down → fall back to public (public mint is on-chain only)
    if (whitelistError) {
      setMintPhase("public")
      return
    }
    if (!whitelistData) return
    // The Worker's phase field is authoritative. Check it FIRST so a
    // public mint is never misclassified as a whitelist mint.
    if (whitelistData.phase === "public") {
      setMintPhase("public")
    } else if (whitelistData.phase === "whitelist" && whitelistData.eligible) {
      setMintPhase("whitelist")
    } else if (whitelistData.phase === "whitelist") {
      // Whitelist deployed but this address isn't on it — public mint stays
      // open on-chain (mintPublic is only gated by paused/maxSupply).
      setMintPhase("public")
    } else {
      setMintPhase("inactive")
    }
  }, [whitelistData, isPaused, whitelistError])

  // After successful mint: reset quantity + invalidate queries
  useEffect(() => {
    if (isConfirmed) {
      setQuantity(1)
      void queryClient.invalidateQueries({ queryKey: ["whitelist"] })
      // wagmi registers contract reads under these prefixes (I2 fix)
      void queryClient.invalidateQueries({ queryKey: ["readContract"] })
      void queryClient.invalidateQueries({ queryKey: ["readContracts"] })
      void queryClient.invalidateQueries({ queryKey: ["balance"] })
    }
  }, [isConfirmed, queryClient])

  const maxQty =
    mintPhase === "whitelist"
      ? Math.min(whitelistData?.mintLimit ?? 1, whitelistRemaining)
      : publicRemaining
  const limitReached = maxQty <= 0

  const handleMint = async () => {
    setLocalError(null)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQty) {
      setLocalError(
        limitReached
          ? "You have reached your mint limit for this address."
          : `Quantity must be between 1 and ${maxQty}`
      )
      return
    }
    reset()

    if (mintPhase === "whitelist") {
      if (!whitelistData?.proof) {
        setLocalError(
          "No whitelist proof available for this address. Please contact the CinaChain team."
        )
        return
      }
      await mintWhitelist(whitelistData.proof, quantity)
    } else if (mintPhase === "public") {
      // Use the on-chain mintPrice so value always matches the contract (I3 fix)
      await mintPublic(quantity, mintPrice?.data)
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
        <div className="container max-w-screen-ultra px-6 py-12">
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
              <CardTitle>Connect wallet</CardTitle>
              <CardDescription>Connect your wallet to mint</CardDescription>
            </CardHeader>
            <CardContent>
              <AppKitConnectButton />
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
        <div className="container max-w-screen-ultra px-6 py-12">
          <Card className="max-w-md shadow-vercel-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Checking mint status...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // On-chain price (fallback to env constant while loading)
  const priceDisplay = mintPrice?.data
    ? formatEther(mintPrice.data).replace(/\.?0+$/, "")
    : String(MINT_PRICE_ETH)
  const totalDisplay = mintPrice?.data
    ? (Number(formatEther(mintPrice.data)) * quantity)
        .toFixed(6)
        .replace(/\.?0+$/, "")
    : (MINT_PRICE_ETH * quantity).toFixed(2)

  // Main mint UI
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Mint
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Mint CinaChain NFT<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            {mintPhase === "whitelist" &&
              "Exclusive whitelist minting is now active."}
            {mintPhase === "public" &&
              "Public minting is now open to everyone."}
            {mintPhase === "inactive" && "Minting is not currently active."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Looking to mint badges in bulk?{" "}
            <Link href="/mint-batch" className="text-link hover:underline">
              Batch mint ERC-1155 →
            </Link>
          </p>
        </div>

        {/* Whitelist service degraded — soft warning, mint still available */}
        {whitelistError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Whitelist service is temporarily unavailable. Showing public mint
              status — whitelist minting may be affected.
            </AlertDescription>
          </Alert>
        )}

        {/* Whitelist deployed but address not on it — public mint still open */}
        {notWhitelisted && (
          <Alert className="border-link/20 bg-link-bg-soft/40 mb-6">
            <Info className="size-4 text-link-deep" />
            <AlertDescription className="text-sm text-link-deep">
              This address is not on the whitelist. Public minting is still open
              — you can mint at the regular price.
            </AlertDescription>
          </Alert>
        )}

        <div className="max-w-md">
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Mint details
                {isGasless && (
                  <span className="bg-cyan/20 rounded-full px-2 py-0.5 text-[10px] font-semibold text-cyan-deep">
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
                <Alert variant="info">
                  <AlertDescription>
                    You are on the whitelist! You can mint up to{" "}
                    <span className="font-semibold">
                      {whitelistData.mintLimit}
                    </span>{" "}
                    NFTs.
                  </AlertDescription>
                </Alert>
              )}

              {mintPhase === "public" && (
                <Alert className="bg-cyan-soft/40 border border-cyan-soft">
                  <AlertDescription className="text-cyan-deep">
                    Public mint active. Price:{" "}
                    <span className="font-semibold">{priceDisplay} ETH</span>{" "}
                    per NFT.
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
              {(localError || error) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="break-all text-sm">
                    {localError ?? error}
                  </AlertDescription>
                </Alert>
              )}

              {isConfirmed && txHash && (
                <Alert variant="success">
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>
                    Mint successful!{" "}
                    <a
                      href={getBlockExplorerUrl("tx", txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      View on {EXPLORER_NAME}{" "}
                      <ExternalLink className="size-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {/* Mint Form */}
              {mintPhase !== "inactive" && (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="quantity"
                      className="text-sm font-medium text-foreground"
                    >
                      Quantity
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={Math.max(maxQty, 1)}
                      value={quantity}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          setQuantity(1)
                          return
                        }
                        const v = Number(e.target.value)
                        if (!Number.isNaN(v)) setQuantity(v)
                      }}
                      className="h-10"
                      disabled={isPending || limitReached}
                    />
                  </div>

                  {/* Price Summary */}
                  <div className="space-y-3 rounded-md border border-border bg-secondary p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Price per NFT
                      </span>
                      <span className="font-medium text-foreground">
                        {priceDisplay} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium text-foreground">
                        {quantity}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-display text-lg text-foreground">
                        {totalDisplay} ETH
                      </span>
                    </div>
                    {mintPhase === "public" && mintedPublicCount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Minted by you</span>
                        <span>
                          {mintedPublicCount} / {MAX_PUBLIC_PER_TX}
                        </span>
                      </div>
                    )}
                    {mintPhase === "whitelist" && mintedWhitelistCount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Whitelist mints by you</span>
                        <span>
                          {mintedWhitelistCount} /{" "}
                          {whitelistData?.mintLimit ?? 3}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Mint Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleMint}
                    disabled={
                      isPending ||
                      quantity < 1 ||
                      limitReached ||
                      status === "awaiting-wallet"
                    }
                  >
                    {limitReached ? (
                      "Mint limit reached"
                    ) : isPending && status === "awaiting-wallet" ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {buttonLabel}
                      </>
                    ) : isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
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
