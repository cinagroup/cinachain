import type { MetadataRoute } from "next"
import { env } from "@/env.mjs"

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL || "https://nft.cinachain.com"
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
