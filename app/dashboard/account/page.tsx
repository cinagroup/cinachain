"use client"

import { useAccount } from "wagmi"
import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletBalance } from "@/components/blockchain/wallet-balance"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/shared/copy-button"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { useSiwe } from "@/lib/hooks/use-siwe"
import Link from "next/link"
import { ExternalLink, Copy, Shield } from "lucide-react"

export default function AccountPage() {
  const { address, isConnected } = useAccount()
  const { session, isAuthenticated, signIn, signOut } = useSiwe()

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <IsWalletConnected>
          {/* Header */}
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Account<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
              Manage your wallet and authentication settings.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Wallet Info */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Wallet
                </CardTitle>
                <CardDescription>Your connected wallet details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <div className="flex items-center gap-2">
                    <WalletAddress className="font-mono-tech text-sm" />
                    <CopyButton value={address || ""} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">ENS Name</p>
                  <div className="flex items-center gap-2">
                    <WalletEnsName className="text-sm font-medium" />
                    <span className="text-xs text-muted-foreground">
                      {session ? "(resolved)" : "(not set)"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Balance</p>
                  <div className="font-display text-xl text-foreground">
                    <WalletBalance decimals={6} /> ETH
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link
                      href={`https://etherscan.io/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Etherscan
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Authentication */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Authentication
                </CardTitle>
                <CardDescription>Sign-In with Ethereum status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SIWE Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isAuthenticated ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <span className="text-sm font-medium">
                      {isAuthenticated ? "Signed In" : "Not Signed In"}
                    </span>
                  </div>
                </div>

                {isAuthenticated && session && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Session Address</p>
                    <p className="font-mono-tech text-xs">
                      {session.address.slice(0, 6)}...{session.address.slice(-4)}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-border">
                  {isAuthenticated ? (
                    <Button onClick={signOut} variant="outline" size="sm" className="w-full">
                      Sign Out
                    </Button>
                  ) : (
                    <Button onClick={signIn} size="sm" className="w-full">
                      Sign In with Ethereum
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card className="mt-6 shadow-vercel-card">
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Useful resources for your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button asChild variant="outline" className="justify-start">
                  <Link
                    href={`https://etherscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Etherscan
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link
                    href={`https://opensea.io/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    OpenSea
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/dashboard">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </IsWalletConnected>

        <IsWalletDisconnected>
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Authentication Required
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
              Connect your wallet<span className="text-foreground">.</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-md">
              Connect your wallet to view your account details, manage settings, and access exclusive features.
            </p>
            <div className="mt-8">
              <SignInButton />
            </div>
          </div>
        </IsWalletDisconnected>
      </div>
    </div>
  )
}
