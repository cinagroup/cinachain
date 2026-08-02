"use client"

import { type ReactNode } from "react"
import { useAccountEffect } from "wagmi"

import { useUser } from "@/lib/hooks/use-user"

interface HandleWalletEventsProps {
  children: ReactNode
}

/**
 * Clears the client-side SIWE session on wallet disconnect.
 *
 * NOTE: SIWE here is UX-only. The authoritative access control for any
 * privileged operation lives in the smart contract (e.g., onlyOwner).
 */
export const HandleWalletEvents = ({ children }: HandleWalletEventsProps) => {
  const { mutateUser } = useUser()

  useAccountEffect({
    onDisconnect() {
      // Clear client-side session (no server round-trip needed)
      if (typeof window !== "undefined") {
        localStorage.removeItem("cinachain-siwe-session")
      }
      void mutateUser()
    },
  })

  return <>{children}</>
}

export default HandleWalletEvents
