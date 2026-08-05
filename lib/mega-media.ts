// CinaMega media resolution — routes ipfs://<cid>/<path> through the
// media-gateway worker (R2 → 4EVERLAND → on-chain fallback) with public
// gateway fallbacks, mirroring lib/ipfs.ts.
import { MEGA_COLLECTION_INFO } from "./exchange"

const MEDIA_GATEWAY =
  process.env.NEXT_PUBLIC_MEGA_MEDIA_URL ??
  "https://cinachain-mega-media.cinagroup.workers.dev"

const FALLBACK_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
]

/** "ipfs://<cid>/<path>" → media-gateway https URL (or the original for data:/https). */
export function megaIpfsToHttps(ipfsUri: string): string {
  if (!ipfsUri.startsWith("ipfs://")) return ipfsUri
  const rest = ipfsUri.slice("ipfs://".length) // <cid>/<path>
  const [cid, ...pathParts] = rest.split("/")
  if (!cid) return ipfsUri
  return `${MEDIA_GATEWAY}/${cid}/${pathParts.join("/")}`
}

/** Ordered image sources for client-side degradation (worker → public gateways). */
export function getMegaImageSources(ipfsUri: string): string[] {
  if (!ipfsUri.startsWith("ipfs://")) return [ipfsUri]
  const rest = ipfsUri.slice("ipfs://".length)
  const [cid, ...pathParts] = rest.split("/")
  if (!cid) return [ipfsUri]
  const path = pathParts.join("/") || "ucina.svg"
  return [
    `${MEDIA_GATEWAY}/${cid}/${path}`,
    ...FALLBACK_GATEWAYS.map((g) => `${g}${cid}/${path}`),
  ]
}

/**
 * Image sources for a token type card: the gateway serves `<cid>/<name>.svg`
 * (metadata.json is NOT an image). Fallback order: worker → public gateways.
 */
export function getMegaTypeImageSources(cid: string, type: number): string[] {
  const name = MEGA_COLLECTION_INFO[type]?.short ?? "ucina"
  return [
    `${MEDIA_GATEWAY}/${cid}/${name}.svg`,
    ...FALLBACK_GATEWAYS.map((g) => `${g}${cid}/${name}.svg`),
  ]
}

/** cid → token type via the contract's uri() strings (read-side helper). */
export function typeFromUri(uri: string): number | null {
  const m = /^ipfs:\/\/([^/]+)\//.exec(uri)
  if (!m) return null
  const byName: Record<string, number> = {
    ucina: 1,
    mcina: 2,
    cina: 3,
  }
  for (const [name, type] of Object.entries(byName)) {
    if (uri.includes(`/${name}.`)) return type
  }
  return null
}

/** Collection display meta keyed by token type (aliases MEGA_COLLECTION_INFO). */
export function collectionDisplay(type: number) {
  return MEGA_COLLECTION_INFO[type] ?? null
}
