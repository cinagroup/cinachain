"use client"

import { useAccount } from "wagmi"
import Link from "next/link"
import { ExternalLink, Loader2 } from "lucide-react"
import CinaNftImage from "@/components/CinaNftImage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FavoriteButton } from "@/components/favorites/favorite-button"
import { useTokenMetadata } from "@/lib/hooks/use-token-metadata"
import { useReadContract } from "wagmi"
import { CINA_NFT_CONTRACT } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"

export default function NftDetailClient({ tokenId }: { tokenId: string }) {
  const { address } = useAccount()
  const { metadata, image, name, description, attributes, isLoading } =
    useTokenMetadata(tokenId)

  const { data: owner } = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })

  const { data: collectionName } = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "name",
  })

  const isOwner =
    !!address && !!owner && address.toLowerCase() === owner.toLowerCase()

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              href="/explore"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Collection
            </Link>
          </li>
          <li className="text-muted-foreground">/</li>
          <li className="font-medium text-foreground">#{tokenId}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Section */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-card shadow-vercel-card">
            {isLoading && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
              </div>
            )}
            {!isLoading && image && (
              <CinaNftImage ipfsCidUrl={image} alt={name || `NFT #${tokenId}`} />
            )}
            {!isLoading && !image && (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-6xl text-muted-foreground/30">
                  #{tokenId}
                </span>
              </div>
            )}

            {/* Favorite button */}
            {!isLoading && (
              <div className="absolute right-3 top-3 rounded-md bg-background/80 backdrop-blur-sm">
                <FavoriteButton tokenId={tokenId} size="lg" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link
                href={`https://etherscan.io/token/${CINA_NFT_CONTRACT}?a=${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Etherscan <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link
                href={`https://opensea.io/assets/ethereum/${CINA_NFT_CONTRACT}/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenSea <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6">
          <div>
            <p className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              Token ID
            </p>
            <h1 className="font-display mt-2 text-3xl tracking-tight text-foreground">
              {isLoading ? "Loading..." : name || `NFT #${tokenId}`}
            </h1>
          </div>

          {owner && (
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Owner</span>
                  {isOwner && (
                    <span className="rounded-full bg-[#50e3c2]/20 px-2 py-0.5 text-xs text-[#29bc9b]">
                      You
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`https://etherscan.io/address/${owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono-tech text-sm text-link transition-colors hover:text-link-deep"
                >
                  {owner}
                </Link>
              </CardContent>
            </Card>
          )}

          {description && (
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          )}

          {attributes.length > 0 && (
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="text-base">Attributes</CardTitle>
                <CardDescription>{attributes.length} traits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attributes.map((attr, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-border bg-secondary p-3"
                    >
                      <p className="font-mono-tech text-[10px] uppercase tracking-wider text-muted-foreground">
                        {attr.trait_type}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {String(attr.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="text-base">Contract Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Collection</dt>
                  <dd className="font-medium text-foreground">
                    {collectionName || "CinaChain NFT"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Contract Address</dt>
                  <dd>
                    <Link
                      href={`https://etherscan.io/address/${CINA_NFT_CONTRACT}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-tech text-link transition-colors hover:text-link-deep"
                    >
                      {CINA_NFT_CONTRACT.slice(0, 6)}...{CINA_NFT_CONTRACT.slice(-4)}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Token Standard</dt>
                  <dd className="font-medium text-foreground">ERC-721</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Blockchain</dt>
                  <dd className="font-medium text-foreground">Ethereum</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
