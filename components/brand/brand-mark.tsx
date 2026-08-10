import Image from "next/image"

import { cn } from "@/lib/utils"

interface BrandMarkProps {
  className?: string
  priority?: boolean
  size?: number
}

export function BrandMark({
  className,
  priority = false,
  size = 28,
}: BrandMarkProps) {
  return (
    <Image
      src="/favicon.ico"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-full", className)}
    />
  )
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className)}>
      Cina
      <span className="text-link dark:text-cyan">Chain</span>
    </span>
  )
}
