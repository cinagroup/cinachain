import { cn } from "@/lib/cn"

interface BrandMarkProps {
  className?: string
  size?: number
}

/** The CinaChain mark — the favicon, rendered as a rounded disc. */
export function BrandMark({ className, size = 28 }: BrandMarkProps) {
  return (
    <img
      src="/favicon.ico"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full", className)}
    />
  )
}

/** The CinaChain wordmark — "Cina" + "Chain" (Chain in the brand accent). */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className)}>
      Cina
      <span className="text-link dark:text-cyan">Chain</span>
    </span>
  )
}
