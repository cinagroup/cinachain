"use client"

import Link from "next/link"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NftCard } from "@/components/nft/nft-card"
import { Heart } from "lucide-react"

export default function FavoritesPage() {
  const { favorites, clearFavorites } = useFavorites()

  return (
    <div className="min-h-screen bg-background">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Dashboard
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Favorites<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
            NFTs you&apos;ve saved for later.
          </p>
        </div>
        {favorites.length > 0 && (
          <Button variant="outline" onClick={clearFavorites}>
            Clear All
          </Button>
        )}
      </div>

      {favorites.length === 0 ? (
        <Card className="shadow-vercel-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">No Favorites Yet</h2>
            <p className="mb-4 text-center text-muted-foreground">
              Start exploring and tap the heart icon to save NFTs you like.
            </p>
            <Button asChild>
              <Link href="/explore">Explore NFTs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((tokenId) => (
            <NftCard key={tokenId} tokenId={tokenId} />
          ))}
        </div>
      )}
    </div>
  )
}
