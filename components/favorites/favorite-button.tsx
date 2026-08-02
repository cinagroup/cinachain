"use client"

import { Heart } from "lucide-react"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  tokenId: string | number
  className?: string
  size?: "sm" | "md" | "lg"
}

/**
 * Heart-shaped favorite toggle button.
 * Uses localStorage via useFavorites hook.
 * Mount on NftCard and NftDetailClient.
 */
export function FavoriteButton({
  tokenId,
  className,
  size = "md",
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(String(tokenId))

  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const padding = {
    sm: "p-1",
    md: "p-1.5",
    lg: "p-2",
  }

  return (
    <button
      type="button"
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(String(tokenId))
      }}
      className={cn(
        "rounded-md transition-colors hover:bg-secondary",
        padding[size],
        className
      )}
    >
      <Heart
        className={cn(
          sizeClasses[size],
          active
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground hover:text-foreground"
        )}
      />
    </button>
  )
}
