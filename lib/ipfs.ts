// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// IPFS utilities — gateway resolution & metadata fetching
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
 * Allowed URI schemes for token metadata. Anything else is rejected to
 * prevent SSRF-style leaks to attacker-controlled servers.
 */
const ALLOWED_SCHEMES = ["ipfs://", "https://"]

/** Strip ipfs:// prefix to extract CID (+ optional path). */
export function extractCid(uri: string): string {
  if (uri.startsWith("ipfs://")) return uri.slice("ipfs://".length)
  // Handle /ipfs/<cid> paths
  const match = uri.match(/\/ipfs\/(.+)$/)
  if (match) return match[1]
  return uri
}

/**
 * Convert an ipfs:// URI to an HTTPS URL on the appropriate gateway.
 * @param uri ipfs:// or https:// URI
 * @param type "image" uses the primary image gateway, "meta" uses the metadata gateway
 */
export function ipfsToHttps(
  uri: string,
  type: "image" | "meta" = "image"
): string {
  // Pass through https:// as-is (after scheme check)
  if (uri.startsWith("https://")) return uri
  // Pass through data: URIs as-is (e.g. on-chain SVG images)
  if (uri.startsWith("data:")) return uri
  if (!uri.startsWith("ipfs://")) return uri

  const cid = extractCid(uri)
  const gateway = type === "meta" ? META_GATEWAY : IPFS_GATEWAY
  return `${gateway}/ipfs/${cid}`
}

/** Get an ordered list of gateway URLs for an IPFS image (for fallback loading). */
export function getIpfsImageSources(ipfsUri: string): string[] {
  // data: URIs are self-contained — nothing to gateway-resolve
  if (ipfsUri.startsWith("data:")) return [ipfsUri]
  const cid = extractCid(ipfsUri)
  const sources = [`${IPFS_GATEWAY}/ipfs/${cid}`]
  FALLBACK_GATEWAYS.forEach((gw) => sources.push(`${gw}${cid}`))
  return sources
}

export interface NftMetadata {
  name?: string
  description?: string
  image?: string
  external_url?: string
  attributes?: Array<{ trait_type: string; value: string | number }>
  [key: string]: unknown
}

function isAllowedUri(uri: string): boolean {
  return ALLOWED_SCHEMES.some((s) => uri.startsWith(s))
}

/** Prefix for on-chain base64-encoded JSON metadata (CinaNFT default) */
const DATA_JSON_PREFIX = "data:application/json;base64,"

/**
 * Fetch NFT metadata from a tokenURI.
 * - Handles on-chain base64 JSON (data: URI) by decoding directly
 * - Validates the URI scheme to prevent SSRF for external fetches
 * - Tries the metadata gateway first, then falls back to public gateways
 * - 8-second timeout per attempt
 * @param tokenUri ipfs://, https://, or data:application/json;base64,... URI
 */
export async function fetchNftMetadata(
  tokenUri: string
): Promise<NftMetadata | null> {
  if (!tokenUri) return null

  // On-chain base64 JSON (CinaNFT default when baseURI is not set)
  if (tokenUri.startsWith(DATA_JSON_PREFIX)) {
    try {
      const b64 = tokenUri.slice(DATA_JSON_PREFIX.length)
      const json = atob(b64)
      return JSON.parse(json) as NftMetadata
    } catch {
      console.warn("[cinachain] Failed to decode on-chain metadata")
      return null
    }
  }

  // Reject non-allowed schemes (SSRF protection)
  if (!isAllowedUri(tokenUri)) {
    console.warn("[cinachain] Rejected tokenURI scheme:", tokenUri.slice(0, 40))
    return null
  }

  const primaryUrl = ipfsToHttps(tokenUri, "meta")
  const fallbackUrls = FALLBACK_GATEWAYS.map(
    (gw) => `${gw}${extractCid(tokenUri)}`
  )

  const tryFetch = async (url: string): Promise<NftMetadata | null> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return null
      return (await res.json()) as NftMetadata
    } catch {
      clearTimeout(timeout)
      return null
    }
  }

  // Try primary then fallbacks
  for (const url of [primaryUrl, ...fallbackUrls]) {
    const data = await tryFetch(url)
    if (data) return data
  }

  return null
}

/** Resolve an NFT image URL from metadata (handles nested ipfs:// in metadata.image). */
export function resolveNftImage(
  metadata: NftMetadata | null,
  fallback?: string
): string | null {
  if (!metadata?.image) return fallback ?? null
  const img = metadata.image
  // Only allow schemes our image pipeline can render safely
  if (
    img.startsWith("ipfs://") ||
    img.startsWith("https://") ||
    img.startsWith("data:")
  ) {
    return ipfsToHttps(img, "image")
  }
  return fallback ?? null
}

/**
 * Deterministic SVG placeholder for tokens without artwork.
 * Generates a data:image/svg+xml;base64 URI — colored per token ID.
 */
export function getNftPlaceholderSvg(tokenId: bigint | number): string {
  const id = Number(tokenId)
  const hue = ((id % 360) * 47 + 13) % 360
  const hue2 = (hue + 40) % 360
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0%' stop-color='hsl(${hue},70%,24%)'/>` +
    `<stop offset='100%' stop-color='hsl(${hue2},65%,44%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='800' height='800' fill='url(#g)'/>` +
    `<circle cx='660' cy='120' r='230' fill='rgba(255,255,255,0.07)'/>` +
    `<circle cx='90' cy='720' r='170' fill='rgba(0,0,0,0.15)'/>` +
    `<text x='60' y='440' font-family='monospace' font-size='104' font-weight='700' fill='rgba(255,255,255,0.95)'>CinaChain</text>` +
    `<text x='60' y='540' font-family='monospace' font-size='72' font-weight='600' fill='rgba(255,255,255,0.85)'>#${id}</text>` +
    `<text x='60' y='726' font-family='monospace' font-size='28' fill='rgba(255,255,255,0.55)'>Built on Base</text>` +
    `</svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export { IPFS_GATEWAY, CDN_GATEWAY, META_GATEWAY }
