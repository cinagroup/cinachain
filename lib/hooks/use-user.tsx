"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { loadCinaauthSession } from "@/lib/auth/cinaauth"

interface User {
  isLoggedIn: boolean
  sub?: string
  name?: string
  email?: string
  picture?: string
}

function getStoredUser(): User {
  if (typeof window === "undefined") return { isLoggedIn: false }
  const session = loadCinaauthSession()
  if (!session) return { isLoggedIn: false }
  return {
    isLoggedIn: true,
    sub: session.user.sub,
    name: session.user.name,
    email: session.user.email,
    picture: session.user.picture,
  }
}

/**
 * Reads the CinaAuth sign-in state (see lib/auth/cinaauth.ts). The sign-in
 * account is independent of the connected wallet, which is only used for
 * on-chain actions.
 */
export function useUser({ redirectTo = "", redirectIfFound = false } = {}) {
  const { data: user, refetch: mutateUser } = useQuery<User>({
    queryKey: ["cinaauth-user"],
    queryFn: getStoredUser,
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
