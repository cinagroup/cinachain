"use client"

import { useEffect, useState } from "react"
import {
  CircleUserRound,
  Loader2,
  LogOut,
  UserRound,
  WalletCards,
} from "lucide-react"
import { createPortal } from "react-dom"
import { useAccount } from "wagmi"

import { useCinaauth } from "@/lib/hooks/use-cinaauth"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/use-toast"
import {
  isAppKitConfigured,
  openAppKit,
} from "@/components/providers/appkit-provider"

interface IdentityPanelProps {
  accountLabel: string
  accountStatus: string
  authError: string | null
  isAuthenticated: boolean
  isAuthConfigured: boolean
  isAuthLoading: boolean
  isAuthSigningIn: boolean
  isWalletConfigured: boolean
  isWalletConnected: boolean
  onAccountAction: () => void
  onWalletAction: () => void
  walletLabel: string
  walletStatus: string
}

function shortenedAddress(address?: `0x${string}`) {
  if (!address) return ""
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function accountName(
  user: { email?: string; name?: string; sub: string } | null
) {
  return user?.name || user?.email || user?.sub || ""
}

function StatusBadge({
  active,
  label,
  loading = false,
}: {
  active: boolean
  label: string
  loading?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1.5 whitespace-nowrap bg-background font-normal"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-success" : "bg-muted-foreground/50"
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  )
}

function IdentityPanel({
  accountLabel,
  accountStatus,
  authError,
  isAuthenticated,
  isAuthConfigured,
  isAuthLoading,
  isAuthSigningIn,
  isWalletConfigured,
  isWalletConnected,
  onAccountAction,
  onWalletAction,
  walletLabel,
  walletStatus,
}: IdentityPanelProps) {
  const { t } = useI18n()

  return (
    <div className="mt-6 space-y-3">
      <section
        className="rounded-lg border border-border bg-card p-4 shadow-vercel-card"
        aria-label={t("identity.accountTitle")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
              <CircleUserRound className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-medium">
                {t("identity.accountTitle")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isAuthenticated
                  ? accountLabel
                  : t("identity.accountDescription")}
              </p>
            </div>
          </div>
          <StatusBadge
            active={isAuthenticated}
            label={accountStatus}
            loading={isAuthLoading}
          />
        </div>

        {authError ? (
          <p className="mt-3 text-xs leading-5 text-destructive" role="alert">
            {authError}
          </p>
        ) : null}

        <Button
          className="mt-4 w-full"
          variant={isAuthenticated ? "outline" : "default"}
          onClick={onAccountAction}
          disabled={
            (isAuthLoading && !isAuthSigningIn) ||
            (!isAuthenticated && !isAuthConfigured)
          }
        >
          {isAuthenticated ? (
            <LogOut className="mr-2 size-4" aria-hidden="true" />
          ) : null}
          {isAuthSigningIn
            ? t("identity.returnToCinaSeek")
            : isAuthLoading
            ? t("action.loading")
            : isAuthenticated
            ? t("identity.signOutAccount")
            : isAuthConfigured
            ? t("identity.continueWithCinaSeek")
            : t("identity.signInUnavailable")}
        </Button>
      </section>

      <section
        className="rounded-lg border border-border bg-card p-4 shadow-vercel-card"
        aria-label={t("identity.walletTitle")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-link-bg-soft text-link-deep">
              <WalletCards className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-medium">
                {t("identity.walletTitle")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isWalletConnected
                  ? walletLabel
                  : t("identity.walletDescription")}
              </p>
            </div>
          </div>
          <StatusBadge active={isWalletConnected} label={walletStatus} />
        </div>

        <Button
          className="mt-4 w-full"
          variant={isWalletConnected ? "outline" : "blue"}
          onClick={onWalletAction}
          disabled={!isWalletConnected && !isWalletConfigured}
        >
          <WalletCards className="mr-2 size-4" aria-hidden="true" />
          {isWalletConnected
            ? t("identity.manageWallet")
            : !isWalletConfigured
            ? `${t("action.connectWallet")} · ${t("status.unavailable")}`
            : t("action.connectWallet")}
        </Button>
      </section>

      <p className="px-1 pt-1 text-xs leading-5 text-muted-foreground">
        {t("identity.independentNote")}
      </p>
    </div>
  )
}

export function IdentityHub() {
  const [mounted, setMounted] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { address, chain, isConnected } = useAccount()
  const { t } = useI18n()
  const {
    error: authError,
    isAuthenticated,
    isConfigured,
    isLoading,
    isSigningIn,
    signIn,
    signOut,
    user,
  } = useCinaauth()

  const accountStatus = isLoading
    ? t("action.loading")
    : isAuthenticated
    ? t("identity.signedIn")
    : t("identity.signedOut")
  const walletStatus = isConnected
    ? t("status.connected")
    : isAppKitConfigured
    ? t("status.disconnected")
    : t("status.unavailable")
  const accountLabel = accountName(user)
  const walletLabel = [shortenedAddress(address), chain?.name]
    .filter(Boolean)
    .join(" · ")
  const statusLabel = t("identity.statusLabel", {
    account: accountStatus,
    wallet: walletStatus,
  })
  const directSignIn = !isAuthenticated && isConfigured
  const directSignInLabel = isSigningIn
    ? t("identity.returnToCinaSeek")
    : isLoading
    ? t("action.loading")
    : t("identity.continueWithCinaSeek")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!authError) return
    toast({
      title: `${t("identity.accountTitle")} · ${t("status.failed")}`,
      description: authError,
      variant: "destructive",
    })
  }, [authError, t])

  function closeSheets() {
    setDesktopOpen(false)
    setMobileOpen(false)
  }

  function handleAccountAction() {
    if (isAuthenticated) {
      closeSheets()
      signOut()
      return
    }

    void signIn()
  }

  function handleWalletAction() {
    if (!isAppKitConfigured) return

    closeSheets()
    window.setTimeout(() => {
      void openAppKit(isConnected ? "Account" : "Connect")
    }, 180)
  }

  const panelProps: IdentityPanelProps = {
    accountLabel,
    accountStatus,
    authError,
    isAuthenticated,
    isAuthConfigured: isConfigured,
    isAuthLoading: isLoading,
    isAuthSigningIn: isSigningIn,
    isWalletConfigured: isAppKitConfigured,
    isWalletConnected: isConnected,
    onAccountAction: handleAccountAction,
    onWalletAction: handleWalletAction,
    walletLabel,
    walletStatus,
  }

  return (
    <>
      <Sheet open={desktopOpen} onOpenChange={setDesktopOpen}>
        {directSignIn ? (
          <Button
            size="sm"
            className="hidden gap-2 md:inline-flex"
            onClick={handleAccountAction}
            disabled={isLoading && !isSigningIn}
            aria-label={directSignInLabel}
          >
            <UserRound className="size-3.5" aria-hidden="true" />
            {directSignInLabel}
          </Button>
        ) : (
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 md:inline-flex"
              aria-label={`${t("identity.title")}. ${statusLabel}`}
            >
              <UserRound className="size-3.5" aria-hidden="true" />
              {t("identity.title")}
              <span className="flex items-center gap-1" aria-hidden="true">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isAuthenticated ? "bg-success" : "bg-muted-foreground/40"
                  )}
                />
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isConnected ? "bg-success" : "bg-muted-foreground/40"
                  )}
                />
              </span>
            </Button>
          </SheetTrigger>
        )}
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-sm"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="font-display text-2xl tracking-tight">
              {t("identity.title")}
              <span className="text-foreground">.</span>
            </SheetTitle>
            <SheetDescription>{t("identity.description")}</SheetDescription>
          </SheetHeader>
          <IdentityPanel {...panelProps} />
        </SheetContent>
      </Sheet>

      {mounted
        ? createPortal(
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              {directSignIn ? (
                <Button
                  size="icon"
                  className="fixed right-4 z-40 !size-12 shadow-vercel-modal md:hidden"
                  style={{
                    bottom: "calc(env(safe-area-inset-bottom) + 16px)",
                  }}
                  onClick={handleAccountAction}
                  disabled={isLoading && !isSigningIn}
                  aria-label={directSignInLabel}
                >
                  {isLoading ? (
                    <Loader2
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserRound className="size-5" aria-hidden="true" />
                  )}
                </Button>
              ) : (
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    className="fixed right-4 z-40 !size-12 shadow-vercel-modal md:hidden"
                    style={{
                      bottom: "calc(env(safe-area-inset-bottom) + 16px)",
                    }}
                    aria-label={`${t("identity.title")}. ${statusLabel}`}
                  >
                    <UserRound className="size-5" aria-hidden="true" />
                    <span
                      className="absolute -right-0.5 -top-0.5 flex rounded-full border-2 border-background bg-card p-1"
                      aria-hidden="true"
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isAuthenticated
                            ? "bg-success"
                            : "bg-muted-foreground/40"
                        )}
                      />
                      <span
                        className={cn(
                          "ml-0.5 size-1.5 rounded-full",
                          isConnected ? "bg-success" : "bg-muted-foreground/40"
                        )}
                      />
                    </span>
                  </Button>
                </SheetTrigger>
              )}
              <SheetContent
                side="bottom"
                className="max-h-[88vh] overflow-y-auto rounded-t-xl px-4 pt-5"
                style={{
                  paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
                }}
              >
                <SheetHeader className="pr-10 text-left">
                  <SheetTitle className="font-display text-2xl tracking-tight">
                    {t("identity.title")}
                    <span className="text-foreground">.</span>
                  </SheetTitle>
                  <SheetDescription>
                    {t("identity.description")}
                  </SheetDescription>
                </SheetHeader>
                <IdentityPanel {...panelProps} />
              </SheetContent>
            </Sheet>,
            document.body
          )
        : null}
    </>
  )
}
