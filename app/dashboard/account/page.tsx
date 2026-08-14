"use client"

import Link from "next/link"
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Shield,
  Wallet,
} from "lucide-react"
import { useAccount, useEnsName } from "wagmi"

import {
  EXPLORER_NAME,
  getBlockExplorerUrl,
  PRIMARY_CHAIN_ID,
  PRIMARY_NETWORK_LABEL,
} from "@/config/deployment"
import { useSiwe } from "@/lib/hooks/use-siwe"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignInButton } from "@/components/blockchain/sign-in-button"
import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletBalance } from "@/components/blockchain/wallet-balance"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { CopyButton } from "@/components/shared/copy-button"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

export default function AccountPage() {
  const { address, chain } = useAccount()
  const {
    session,
    isAuthenticated,
    signIn,
    signOut,
    isLoading: siweLoading,
  } = useSiwe()

  // ENS resolution (independent of SIWE session)
  const { data: ensName, isLoading: ensLoading } = useEnsName({ address })

  const connectedNetwork =
    chain?.id === PRIMARY_CHAIN_ID
      ? PRIMARY_NETWORK_LABEL
      : chain
      ? `${chain.name} (unsupported)`
      : "Unknown"

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1400px] px-6 py-12">
        <IsWalletConnected>
          {/* Header */}
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Account<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
              Manage your wallet and authentication settings.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Wallet Info */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5" />
                  Wallet
                </CardTitle>
                <CardDescription>Your connected wallet details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Address</p>
                  <div className="flex items-center gap-2">
                    <WalletAddress className="font-mono-tech text-sm" />
                    <CopyButton
                      value={address || ""}
                      className="h-8 px-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">ENS name</p>
                  <div className="flex items-center gap-2">
                    {ensLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <WalletEnsName className="text-sm font-medium" />
                        <span className="text-xs text-muted-foreground">
                          {ensName ? "(resolved)" : "(no ENS)"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Network</p>
                  <p className="text-sm font-medium text-foreground">
                    {connectedNetwork}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Balance</p>
                  <div className="font-display text-xl text-foreground">
                    <WalletBalance decimals={6} /> ETH
                  </div>
                </div>

                <div className="border-t border-border pt-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link
                      href={getBlockExplorerUrl("address", address ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 size-4" />
                      View on {EXPLORER_NAME}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Authentication */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-5" />
                  Authentication
                </CardTitle>
                <CardDescription>Sign-In with Ethereum status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    SIWE status
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2 rounded-full ${
                        isAuthenticated ? "bg-success" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {isAuthenticated ? "Signed in" : "Not signed in"}
                    </span>
                  </div>
                </div>

                {isAuthenticated && session && (
                  <div className="border-success/30 bg-success/10 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success" />
                      <span className="text-sm text-success">
                        Authenticated
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Session expires:{" "}
                      {new Date(session.expirationTime).toLocaleString()}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  SIWE proves wallet ownership via a cryptographic signature.
                  This is a UX-only sign-in — the smart contract&apos;s{" "}
                  <code className="rounded bg-secondary px-1">onlyOwner</code>{" "}
                  modifier is the authoritative access control.
                </p>

                <div className="border-t border-border pt-2">
                  {isAuthenticated ? (
                    <Button
                      onClick={signOut}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void signIn()}
                      size="sm"
                      className="w-full"
                      disabled={siweLoading}
                    >
                      {siweLoading ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Sign in with Ethereum
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card className="mt-6 shadow-vercel-card">
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
              <CardDescription>
                Useful resources for your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button asChild variant="outline" className="justify-start">
                  <Link
                    href={getBlockExplorerUrl("address", address ?? "")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    {EXPLORER_NAME}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/dashboard/nfts">
                    <Wallet className="mr-2 size-4" />
                    My NFTs
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/mint">
                    <Shield className="mr-2 size-4" />
                    Mint page
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </IsWalletConnected>

        <IsWalletDisconnected>
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Authentication required
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
              Connect your wallet<span className="text-foreground">.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Connect your wallet to view your account details, manage settings,
              and access exclusive features.
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
