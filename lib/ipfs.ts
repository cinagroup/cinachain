const PRIMARY_GATEWAY =
  process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY || "https://ipfs.cinachain.com"

const FALLBACK_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
]

/**
 * ipfs://CID 转为 HTTPS 链接（主网关）
 */
export function ipfsToHttps(uri: string): string {
  if (!uri.startsWith("ipfs://")) return uri
  const cid = uri.replace("ipfs://", "")
  return `${PRIMARY_GATEWAY}/ipfs/${cid}`
}

/**
 * 获取网关优先级数组（用于图片加载失败自动切换）
 */
export function getIpfsImageSources(ipfsUri: string): string[] {
  const cid = ipfsUri.replace("ipfs://", "")
  const sources = [`${PRIMARY_GATEWAY}/ipfs/${cid}`]
  FALLBACK_GATEWAYS.forEach((gw) => sources.push(`${gw}${cid}`))
  return sources
}

/**
 * 从 ipfs:// URI 中提取 CID
 */
export function extractCid(uri: string): string {
  return uri.replace("ipfs://", "")
}
