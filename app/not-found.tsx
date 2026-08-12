import Link from "next/link"
import { Home, Compass, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        404
      </span>

      <h1 className="font-display mt-4 text-5xl tracking-tight text-foreground sm:text-6xl">
        Page not found<span className="text-muted-foreground">.</span>
      </h1>

      <p className="mt-4 max-w-md text-base text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className={cn(
            buttonVariants({ size: "lg" }),
            "btn-pill"
          )}
        >
          <Home className="mr-2 size-4" />
          Back home
        </Link>
        <Link
          href="/explore"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "btn-pill"
          )}
        >
          <Compass className="mr-2 size-4" />
          Explore collection
        </Link>
        <Link
          href="/mint"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "btn-pill"
          )}
        >
          <Sparkles className="mr-2 size-4" />
          Mint NFT
        </Link>
      </div>
    </div>
  )
}
