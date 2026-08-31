"use client"

import Link from "next/link"
import { ExternalLink, Loader2 } from "lucide-react"
import { useAccount, useReadContract } from "wagmi"

import {
  EXPLORER_NAME,
  getBlockExplorerUrl,
  PRIMARY_NETWORK_NAME,
} from "@/config/deployment"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"
import { CINA_NFT_CONTRACT } from "@/lib/contracts/addresses"
import { useTokenMetadata } from "@/lib/hooks/use-token-metadata"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import CinaNftImage from "@/components/CinaNftImage"
import { FavoriteButton } from "@/components/favorites/favorite-button"
import { useI18n } from "@/lib/i18n"

export default function NftDetailClient({ tokenId }: { tokenId: string }) {
  const { t } = useI18n()
  const { address } = useAccount()
  const { metadata, image, name, description, attributes, isLoading } =
    useTokenMetadata(tokenId)

  const {
    data: owner,
    isError: ownerError,
    isPending: ownerLoading,
  } = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
    // Reverts are deterministic for unminted ids — no point retrying
    query: { retry: false },
  })

  const { data: collectionName } = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "name",
  })

  const isOwner =
    !!address && !!owner && address.toLowerCase() === owner.toLowerCase()

  // Explicit "not minted yet" state for tokens that don't exist on-chain
  if (!ownerLoading && ownerError) {
    return (
      <div>
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link
                href="/explore"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("explore.eyebrow")}
              </Link>
            </li>
            <li className="text-muted-foreground">/</li>
            <li className="font-medium text-foreground">#{tokenId}</li>
          </ol>
        </nav>

        <div className="mx-auto mt-16 max-w-md rounded-lg border border-border bg-card p-10 text-center shadow-vercel-card">
          <p className="font-display text-2xl tracking-tight text-foreground">
            {t("nftDetail.notMintedTitle")}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("nftDetail.notMintedDescription", { tokenId })}
          </p>
          <Button asChild className="mt-6">
            <Link href="/mint">
              {t("nftDetail.mintToken", { tokenId })}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              href="/explore"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("explore.eyebrow")}
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
                <Loader2 className="size-8 animate-spin text-muted-foreground/40" />
              </div>
            )}
            {!isLoading && image && (
              <CinaNftImage
                ipfsCidUrl={image}
                alt={name || `NFT #${tokenId}`}
              />
            )}
            {!isLoading && !image && (
              <div className="flex size-full items-center justify-center">
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
                href={getBlockExplorerUrl("token", CINA_NFT_CONTRACT, {
                  a: tokenId,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                {EXPLORER_NAME} <ExternalLink className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6">
          <div>
            <p className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
              {t("nftDetail.tokenId")}
            </p>
            <h1 className="font-display mt-2 text-3xl tracking-tight text-foreground">
              {isLoading
                ? t("action.loading")
                : name || `NFT #${tokenId}`}
            </h1>
          </div>

          {owner && (
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{t("nftDetail.owner")}</span>
                  {isOwner && (
                    <span className="bg-cyan/20 rounded-full px-2 py-0.5 text-xs text-cyan-deep">
                      {t("nftDetail.you")}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={getBlockExplorerUrl("address", owner)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-tech break-all text-sm text-link transition-colors hover:text-link-deep"
                >
                  {owner}
                </Link>
              </CardContent>
            </Card>
          )}

          {description && (
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("nftDetail.description")}
                </CardTitle>
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
                <CardTitle className="text-base">
                  {t("nftDetail.attributes")}
                </CardTitle>
                <CardDescription>
                  {t("nftDetail.traits", { count: attributes.length })}
                </CardDescription>
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
              <CardTitle className="text-base">
                {t("nftDetail.contractDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("explore.eyebrow")}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {collectionName || "CinaChain NFT"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("nftDetail.contractAddress")}
                  </dt>
                  <dd>
                    <Link
                      href={getBlockExplorerUrl("address", CINA_NFT_CONTRACT)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-tech text-link transition-colors hover:text-link-deep"
                    >
                      {CINA_NFT_CONTRACT.slice(0, 6)}...
                      {CINA_NFT_CONTRACT.slice(-4)}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("nftDetail.tokenStandard")}
                  </dt>
                  <dd className="font-medium text-foreground">ERC-721</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("nftDetail.blockchain")}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {PRIMARY_NETWORK_NAME}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
