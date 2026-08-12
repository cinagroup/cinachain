"use client"

import { modal } from "@reown/appkit/react"
import { useAccount } from "wagmi"

import { useSiwe } from "@/lib/hooks/use-siwe"
import { Button } from "@/components/ui/button"

export function SignInButton() {
  const { isConnected } = useAccount()
  const { session, isAuthenticated, isLoading, signIn, signOut } = useSiwe()

  if (!isConnected) {
    return (
      <Button onClick={() => modal?.open({ view: "Connect" })} size="sm">
        Connect wallet
      </Button>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Signed in as {session?.address.slice(0, 6)}...
          {session?.address.slice(-4)}
        </span>
        <Button onClick={signOut} variant="outline" size="sm">
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={signIn} disabled={isLoading} size="sm">
      {isLoading ? "Signing..." : "Sign in"}
    </Button>
  )
}
