import { useEffect, useState } from "react"

const FAVORITES_KEY = "cinachain-nft-favorites"

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        try {
          setFavorites(JSON.parse(stored))
        } catch (error) {
          console.error("Failed to parse favorites:", error)
        }
      }
    }
  }, [])

  // Save to localStorage whenever favorites change
  const updateFavorites = (newFavorites: string[]) => {
    setFavorites(newFavorites)
    if (typeof window !== "undefined") {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites))
    }
  }

  const toggleFavorite = (tokenId: string) => {
    if (favorites.includes(tokenId)) {
      updateFavorites(favorites.filter((id) => id !== tokenId))
    } else {
      updateFavorites([...favorites, tokenId])
    }
  }

  const isFavorite = (tokenId: string) => {
    return favorites.includes(tokenId)
  }

  const clearFavorites = () => {
    updateFavorites([])
  }

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  }
}
