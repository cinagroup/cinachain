"use client"

import Link from "next/link"
import { useFavorites } from "@/lib/hooks/use-favorites"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart } from "lucide-react"

export default function FavoritesPage() {
  const { favorites, clearFavorites } = useFavorites()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Favorites</h1>
          <p className="text-muted-foreground mt-2">
            NFTs you've saved for later
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
              <Card className="transition-all hover:shadow-lg">
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
  )
}
