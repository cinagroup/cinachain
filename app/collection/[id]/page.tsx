import { generateStaticParams as generateParams } from "@/lib/static-params"
import NftDetailClient from "./NftDetailClient"

// 预生成静态参数（支持静态导出）
export async function generateStaticParams() {
  return generateParams("collection")
}

export default function NftDetailPage({ params }: { params: { id: string } }) {
  return <NftDetailClient tokenId={params.id} />
}
