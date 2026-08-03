import { useEffect, useState } from "react"

const FAVORITES_KEY = "cinachain-nft-favorites"

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // Load favorites from localStorage on mount (single effect)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        setFavorites(JSON.parse(stored))
      }
    } catch {
      // Corrupted data — reset
      localStorage.removeItem(FAVORITES_KEY)
    }
    setMounted(true)
  }, [])

  // Save to localStorage with error handling
  const updateFavorites = (newFavorites: string[]) => {
    setFavorites(newFavorites)
    if (typeof window === "undefined") return
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites))
    } catch {
      // Quota exceeded or private mode — keep in-memory state only
      console.warn("[cinachain] Failed to persist favorites")
    }
  }

  const toggleFavorite = (tokenId: string) => {
    if (favorites.includes(tokenId)) {
      updateFavorites(favorites.filter((id) => id !== tokenId))
    } else {
      updateFavorites([...favorites, tokenId])
    }
  }

  const isFavorite = (tokenId: string) => favorites.includes(tokenId)

  const clearFavorites = () => updateFavorites([])

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    mounted,
  }
}
