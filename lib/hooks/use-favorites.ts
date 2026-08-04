import { useSyncExternalStore } from "react"
import { useAccount } from "wagmi"

const BASE_KEY = "cinachain-nft-favorites"

function storageKeyFor(address?: string): string {
  return address ? `${BASE_KEY}:${address.toLowerCase()}` : BASE_KEY
}

function readFromStorage(key: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/**
 * Per-key module store. All hook instances for the same key share one
 * snapshot + listener set, so toggling a favorite on a card immediately
 * updates the Favorites page grid (and vice versa) without a reload.
 */
interface FavoritesStore {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => string[]
  set: (next: string[]) => void
}

const stores = new Map<string, FavoritesStore>()

function getStore(key: string): FavoritesStore {
  let store = stores.get(key)
  if (store) return store

  let cache: string[] | null = null
  const listeners = new Set<() => void>()

  store = {
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getSnapshot() {
      if (cache === null) cache = readFromStorage(key)
      return cache
    },
    set(next) {
      cache = next
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // Quota exceeded or private mode — keep in-memory state only
          console.warn("[cinachain] Failed to persist favorites")
        }
      }
      for (const l of listeners) l()
    },
  }
  stores.set(key, store)
  return store
}

/**
 * Favorites are namespaced per wallet address, so two wallets on the same
 * browser never share a list. Without a connected wallet they use a global
 * anonymous list.
 */
export function useFavorites() {
  const { address } = useAccount()
  const key = storageKeyFor(address)
  const store = getStore(key)
  // Server snapshot: no localStorage during prerender (static export)
  const favorites = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => []
  )

  const toggleFavorite = (tokenId: string) => {
    store.set(
      favorites.includes(tokenId)
        ? favorites.filter((id) => id !== tokenId)
        : [...favorites, tokenId]
    )
  }

  const isFavorite = (tokenId: string) => favorites.includes(tokenId)

  const clearFavorites = () => store.set([])

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    mounted: true,
  }
}
