"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import {
  completeCinaauthLogin,
  toCinaauthErrorMessage,
} from "@/lib/auth/cinaauth"
import { Button } from "@/components/ui/button"

/**
 * CinaAuth OIDC redirect target. The static export has no server runtime,
 * so the authorization code is exchanged for tokens entirely client-side
 * (public client + PKCE), after which the user is sent back to where the
 * sign-in started.
 */
export default function CinaauthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    completeCinaauthLogin()
      .then(({ returnTo }) => {
        // Full navigation: already-mounted components (header sign-in
        // state) re-read the session from localStorage on next mount.
        window.location.replace(returnTo)
      })
      .catch((cause: unknown) => {
        setError(toCinaauthErrorMessage(cause))
      })
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {error ? (
        <>
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Sign-in failed
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground">
            Could not complete sign-in<span className="text-foreground">.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            {error}
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="mt-4 text-base text-muted-foreground">
            Completing sign-in…
          </p>
        </>
      )}
    </div>
  )
}
