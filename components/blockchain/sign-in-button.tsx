"use client"

import { useCinaauth } from "@/lib/hooks/use-cinaauth"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

function userLabel(name?: string, email?: string, sub?: string): string {
  const label = name || email || sub || ""
  if (label.length > 20) return `${label.slice(0, 18)}...`
  return label
}

/**
 * CinaSeek Accounts single sign-on button (OIDC, accounts.cinaseek.ai).
 *
 * Signing in is independent of the connected wallet: wallet connection
 * stays available for on-chain actions via the AppKit connect button.
 */
export function SignInButton() {
  const { t } = useI18n()
  const {
    user,
    isAuthenticated,
    isLoading,
    isSigningIn,
    isConfigured,
    signIn,
    signOut,
  } = useCinaauth()

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="text-xs text-muted-foreground"
          title={user.email ?? user.name ?? user.sub}
        >
          {t("identity.signedIn")}: {userLabel(user.name, user.email, user.sub)}
        </span>
        <Button onClick={signOut} variant="outline" size="sm">
          {t("identity.signOutAccount")}
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={() => {
        void signIn()
      }}
      disabled={(isLoading && !isSigningIn) || !isConfigured}
      size="sm"
      title={
        isConfigured
          ? undefined
          : t("identity.signInUnavailable")
      }
    >
      {isSigningIn
        ? t("identity.returnToCinaSeek")
        : isLoading
        ? t("account.openingCinaSeek")
        : t("identity.continueWithCinaSeek")}
    </Button>
  )
}
