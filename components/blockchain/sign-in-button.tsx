"use client"

import { useCinaauth } from "@/lib/hooks/use-cinaauth"
import { Button } from "@/components/ui/button"

function userLabel(name?: string, email?: string, sub?: string): string {
  const label = name || email || sub || ""
  if (label.length > 20) return `${label.slice(0, 18)}...`
  return label
}

/**
 * CinaAuth single sign-on button (OIDC, accounts.cinaseek.ai).
 *
 * Signing in is independent of the connected wallet: wallet connection
 * stays available for on-chain actions via the AppKit connect button.
 */
export function SignInButton() {
  const {
    user,
    isAuthenticated,
    isLoading,
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
          Signed in as {userLabel(user.name, user.email, user.sub)}
        </span>
        <Button onClick={signOut} variant="outline" size="sm">
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={() => {
        const returnTo = `${window.location.pathname}${window.location.search}`
        void signIn(returnTo)
      }}
      disabled={isLoading || !isConfigured}
      size="sm"
      title={
        isConfigured
          ? undefined
          : "Set NEXT_PUBLIC_CINAAUTH_CLIENT_ID to enable CinaAuth sign-in"
      }
    >
      {isLoading ? "Signing..." : "Sign in"}
    </Button>
  )
}
