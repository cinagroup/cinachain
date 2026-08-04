import type { Metadata } from "next"
import { generateStaticParams as generateParams } from "@/lib/static-params"
import NftDetailClient from "./NftDetailClient"

// 预生成静态参数（支持静态导出）
export function generateStaticParams() {
  return generateParams("collection")
}

// Per-token metadata — de-duplicates the 500 SSG pages in search indexes and
// gives each NFT its own title/OG card on share. On-chain name/description
// can't be read at build time, so the token-id title is generated statically.
export function generateMetadata({
  params,
}: {
  params: { id: string }
}): Metadata {
  const tokenId = params.id
  return {
    title: `CinaChain NFT #${tokenId}`,
    description: `CinaChain NFT #${tokenId} — a collectible on the Base network.`,
    alternates: {
      canonical: `/collection/${tokenId}`,
    },
    openGraph: {
      title: `CinaChain NFT #${tokenId}`,
      description: `CinaChain NFT #${tokenId} — a collectible on the Base network.`,
      url: `/collection/${tokenId}`,
    },
  }
}

export default function NftDetailPage({ params }: { params: { id: string } }) {
  return <NftDetailClient tokenId={params.id} />
}
