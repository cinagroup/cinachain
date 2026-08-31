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
import { useCinaauth } from "@/lib/hooks/use-cinaauth"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletBalance } from "@/components/blockchain/wallet-balance"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { CopyButton } from "@/components/shared/copy-button"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

export default function AccountPage() {
  const { t } = useI18n()
  const { address, chain } = useAccount()
  const {
    session,
    user,
    isAuthenticated,
    signIn,
    signOut,
    isLoading: authLoading,
    isSigningIn: authSigningIn,
  } = useCinaauth()

  // ENS resolution (independent of CinaAuth sign-in)
  const { data: ensName, isLoading: ensLoading } = useEnsName({ address })

  const connectedNetwork =
    chain?.id === PRIMARY_CHAIN_ID
      ? PRIMARY_NETWORK_LABEL
      : chain
      ? t("account.unsupportedNetwork", { network: chain.name })
      : t("account.unknownNetwork")

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        <IsWalletConnected>
          {/* Header */}
          <div className="mb-8">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              {t("nav.dashboard")}
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("account.title")}<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
              {t("account.description")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Wallet Info */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="size-5" />
                  {t("identity.walletTitle")}
                </CardTitle>
                <CardDescription>{t("account.walletDetails")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("account.address")}
                  </p>
                  <div className="flex items-center gap-2">
                    <WalletAddress className="font-mono-tech text-sm" />
                    <CopyButton
                      value={address || ""}
                      className="h-8 px-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("account.ensName")}
                  </p>
                  <div className="flex items-center gap-2">
                    {ensLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <WalletEnsName className="text-sm font-medium" />
                        <span className="text-xs text-muted-foreground">
                          {ensName
                            ? t("account.ensResolved")
                            : t("account.noEns")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("account.network")}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {connectedNetwork}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("account.balance")}
                  </p>
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
                      {t("common.viewOn", { explorer: EXPLORER_NAME })}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CinaSeek account authentication */}
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-5" />
                  {t("account.authentication")}
                </CardTitle>
                <CardDescription>
                  {t("account.cinaSeekSso")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("account.cinaSeekStatus")}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2 rounded-full ${
                        isAuthenticated ? "bg-success" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {isAuthenticated
                        ? t("identity.signedIn")
                        : t("identity.signedOut")}
                    </span>
                  </div>
                </div>

                {isAuthenticated && session && user && (
                  <div className="border-success/30 bg-success/10 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-success" />
                      <span className="text-sm text-success">
                        {t("account.authenticated")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.name && user.name !== user.email
                        ? `${user.name} · `
                        : ""}
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("account.sessionExpires")} {" "}
                      {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {t("account.cinaSeekDescription")}
                </p>

                <div className="border-t border-border pt-2">
                  {isAuthenticated ? (
                    <Button
                      onClick={signOut}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {t("action.signOut")}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void signIn()}
                      size="sm"
                      className="w-full"
                      disabled={authLoading && !authSigningIn}
                    >
                      {authLoading && !authSigningIn ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      {authSigningIn
                        ? t("identity.returnToCinaSeek")
                        : authLoading
                        ? t("account.openingCinaSeek")
                        : t("identity.continueWithCinaSeek")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card className="mt-6 shadow-vercel-card">
            <CardHeader>
              <CardTitle>{t("account.quickLinks")}</CardTitle>
              <CardDescription>
                {t("account.quickLinksDescription")}
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
                    {t("sidebar.myNfts")}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/mint">
                    <Shield className="mr-2 size-4" />
                    {t("account.mintPage")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </IsWalletConnected>

        <IsWalletDisconnected>
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.required")}
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
              {t("auth.connectWalletTitle")}
              <span className="text-foreground">.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              {t("account.connectDescription")}
            </p>
            <div className="mt-8">
              <WalletConnect />
            </div>
          </div>
        </IsWalletDisconnected>
      </div>
    </div>
  )
}
