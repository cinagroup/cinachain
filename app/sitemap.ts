import type { MetadataRoute } from "next"
import { env } from "@/env.mjs"
import { MAX_TOKENS } from "@/lib/static-params"

// Static sitemap — generated at build time for static export.
// Includes the 500 prerendered NFT detail pages.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (env.NEXT_PUBLIC_SITE_URL || "https://nft.cinachain.com").replace(
    /\/$/,
    ""
  )

  const staticRoutes = [
    "",
    "/explore",
    "/collections",
    "/exchange",
    "/mint",
    "/mint-batch",
    "/credits",
    "/keys",
    "/settings",
    "/integration/erc20",
    "/integration/erc721",
    "/integration/erc1155",
    "/integration/sign-in-with-ethereum",
    "/dashboard",
    "/dashboard/account",
    "/dashboard/badges",
    "/dashboard/favorites",
    "/dashboard/nfts",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }))

  const collectionRoutes = Array.from({ length: MAX_TOKENS }, (_, i) => ({
    url: `${baseUrl}/collection/${i + 1}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.5,
  }))

  return [...staticRoutes, ...collectionRoutes]
}
