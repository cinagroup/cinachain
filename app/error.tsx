"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[cinachain] Uncaught error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <AlertTriangle className="size-12 text-foreground/40" />
      <h2 className="font-display mt-6 text-2xl tracking-tight text-foreground">
        Something went wrong<span className="text-muted-foreground">.</span>
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      {error.digest && (
        <p className="font-mono-tech mt-2 text-xs text-muted-foreground/60">
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className={cn(buttonVariants({ size: "lg" }), "btn-pill mt-8")}
      >
        <RotateCcw className="mr-2 size-4" />
        Try Again
      </button>
    </div>
  )
}
