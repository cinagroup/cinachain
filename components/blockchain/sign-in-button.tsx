"use client"

import { Button } from "@/components/ui/button"
import { useSiwe } from "@/lib/hooks/use-siwe"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export function SignInButton() {
  const { isConnected } = useAccount()
  const { session, isAuthenticated, isLoading, signIn, signOut } = useSiwe()

  if (!isConnected) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button onClick={openConnectModal} size="sm">
            Connect Wallet
          </Button>
        )}
      </ConnectButton.Custom>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Signed in as {session?.address.slice(0, 6)}...{session?.address.slice(-4)}
        </span>
        <Button onClick={signOut} variant="outline" size="sm">
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={signIn} disabled={isLoading} size="sm">
      {isLoading ? "Signing..." : "Sign In"}
    </Button>
  )
}
