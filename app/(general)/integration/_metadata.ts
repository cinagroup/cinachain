import type { Metadata } from "next"
import { cinaIntegrations } from "@/data/cina-integrations"

type IntegrationKey = keyof typeof cinaIntegrations

export function createIntegrationMetadata(
  integration: IntegrationKey
): Metadata {
  const { description, href, name } = cinaIntegrations[integration]
  const title = `${name} Integration`

  return {
    title,
    description,
    alternates: {
      canonical: href,
    },
    openGraph: {
      title,
      description,
      url: href,
      type: "website",
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: `${name} on CinaChain`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image.png"],
    },
  }
}
