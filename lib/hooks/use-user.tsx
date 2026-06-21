"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"

interface User {
  isLoggedIn: boolean
  address?: string
  isAdmin?: boolean
}

const SESSION_KEY = "cinachain-siwe-session"

function getStoredUser(): User {
  if (typeof window === "undefined") return { isLoggedIn: false }
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (new Date(parsed.expirationTime) > new Date()) {
        return {
          isLoggedIn: true,
          address: parsed.address,
        }
      }
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    localStorage.removeItem(SESSION_KEY)
  }
  return { isLoggedIn: false }
}

export function useUser({ redirectTo = "", redirectIfFound = false } = {}) {
  const { address } = useAccount()

  const { data: user, refetch: mutateUser } = useQuery<User>({
    queryKey: ["user", address],
    queryFn: async () => {
      if (!address) return { isLoggedIn: false }
      const stored = getStoredUser()
      if (stored.isLoggedIn && stored.address?.toLowerCase() === address.toLowerCase()) {
        return stored
      }
      return { isLoggedIn: false }
    },
  })

  const Router = useRouter()

  useEffect(() => {
    if (!redirectTo || !user) return

    if (
      (redirectTo && !redirectIfFound && !user?.isLoggedIn) ||
      (redirectIfFound && user?.isLoggedIn)
    ) {
      Router.push(redirectTo)
    }
  }, [user, redirectIfFound, redirectTo])

  return { user, mutateUser }
}
