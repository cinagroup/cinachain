import Link from "next/link"
import { WifiOff } from "lucide-react"

// Branded offline page served by the service worker when the network fails.
// Must stay dependency-light and client-hook-free — it runs from cache.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-10 text-center shadow-vercel-card">
        <WifiOff className="mx-auto size-12 text-muted-foreground/40" />
        <h1 className="font-display mt-6 text-2xl tracking-tight text-foreground">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The network connection was lost. Your cached CinaChain pages are
          still available — check back once you&apos;re back online.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="btn-pill inline-flex items-center justify-center bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Back Home
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Explore
          </Link>
        </div>
      </div>
    </div>
  )
}
