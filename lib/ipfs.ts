const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY || "https://ipfs.cinachain.com"
const CDN_GATEWAY =
  process.env.NEXT_PUBLIC_CF_CDN_GATEWAY || "https://cdn.cinachain.com"
const META_GATEWAY =
  process.env.NEXT_PUBLIC_CF_META_GATEWAY || "https://meta.cinachain.com"

const FALLBACK_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
]

/**
 * ipfs://CID 转为 HTTPS 链接
 * @param uri ipfs:// URI
 * @param type "image" 使用 ipfs 网关，"meta" 使用元数据网关
 */
export function ipfsToHttps(
  uri: string,
  type: "image" | "meta" = "image"
): string {
  if (!uri.startsWith("ipfs://")) return uri
  const cid = uri.replace("ipfs://", "")
  const gateway = type === "meta" ? META_GATEWAY : IPFS_GATEWAY
  return `${gateway}/ipfs/${cid}`
}

/** 获取网关优先级数组（用于图片加载失败自动切换） */
export function getIpfsImageSources(ipfsUri: string): string[] {
  const cid = ipfsUri.replace("ipfs://", "")
  const sources = [`${IPFS_GATEWAY}/ipfs/${cid}`]
  FALLBACK_GATEWAYS.forEach((gw) => sources.push(`${gw}${cid}`))
  return sources
}

export function extractCid(uri: string): string {
  return uri.replace("ipfs://", "")
}
