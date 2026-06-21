"use client"

import Link from "next/link"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart } from "lucide-react"

export default function FavoritesPage() {
  const { favorites, clearFavorites } = useFavorites()

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </span>
            <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
              Favorites<span className="text-foreground">.</span>
            </h1>
            <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
              NFTs you've saved for later.
            </p>
          </div>
          {favorites.length > 0 && (
            <Button variant="outline" onClick={clearFavorites}>
              Clear All
            </Button>
          )}
        </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Favorites Yet</h2>
            <p className="text-muted-foreground text-center mb-4">
              Start exploring and save NFTs you like to see them here
            </p>
            <Button asChild>
              <Link href="/explore">Explore NFTs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((tokenId) => (
            <Link key={tokenId} href={`/collection/${tokenId}`}>
              <Card className="transition-all hover:shadow-vercel-lg">
                <CardContent className="pt-6">
                  <div className="aspect-square relative rounded-lg overflow-hidden bg-muted mb-4">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Heart className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="font-semibold">NFT #{tokenId}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click to view details
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
