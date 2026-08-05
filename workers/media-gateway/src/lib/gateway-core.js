// CinaMega media gateway — core decision logic (pure, unit-testable).
//
// Fallback chain (Attachment-2, four layers):
//   1. R2 hit (normal path, vast majority of requests)
//   2. 4EVERLAND gateway origin fetch → write-through to R2
//   3. On-chain SVG fallback (getBackupSvgRaw) → assemble metadata, write-through
//   4. 503
//
// The gateway serves `/<cid>/<path>` where <cid> is the directory CID stored
// in the CinaMega contract and <path> is metadata.json or <name>.svg.

// cid → tokenType map from env ("<cid>:<type>,<cid>:<type>,...")
export function parseCidMap(envMap) {
  const map = {}
  if (!envMap) return map
  for (const pair of envMap.split(",")) {
    const [cid, type] = pair.split(":")
    if (cid && type) map[cid.trim()] = Number(type.trim())
  }
  return map
}

// Parse /<cid>/<path> from the URL pathname.
export function extractCidPath(pathname) {
  const m = /^\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!m) return null
  return { cid: m[1], path: m[2] }
}

// Decode a solc/viem ABI bytes return value: 0x<offset(32)><length(32)><data>
export function decodeBytesReturn(hex) {
  if (!hex || hex === "0x") return new Uint8Array(0)
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex
  if (raw.length < 128) return new Uint8Array(0)
  const lengthHex = raw.slice(64, 128)
  const length = parseInt(lengthHex, 16)
  if (!Number.isFinite(length) || length * 2 > raw.length - 128) return new Uint8Array(0)
  const body = raw.slice(128, 128 + length * 2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function toBase64(bytes) {
  // Uint8Array → base64 without Buffer (workers runtime compatibility).
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// On-chain metadata fallback — mirrors scripts/generate-mega-assets.mjs so
// the disaster path renders the same artwork the IPFS path would.
export const MEGA_META = {
  1: {
    name: "UCINA — CinaMega #1",
    description:
      "UCINA — the base unit of the CinaMega collection. Free to mint, unlimited supply, and the entry point to the Cina economy. Exchange 1,000,000 UCINA for 1 CINA.",
    rate: "1 UCINA = 1 unit",
  },
  2: {
    name: "MCINA — CinaMega #2",
    description:
      "MCINA — the mid unit of the CinaMega collection. 1 MCINA = 1,000 UCINA. Obtained only by exchanging up from UCINA. 1,000 MCINA = 1 CINA.",
    rate: "1 MCINA = 1,000 UCINA",
  },
  3: {
    name: "CINA — CinaMega #3",
    description:
      "CINA — the flagship unit of the CinaMega collection. 1 CINA = 1,000 MCINA = 1,000,000 UCINA. Obtained only by exchanging up through the Cina economy.",
    rate: "1 CINA = 1,000,000 UCINA",
  },
}

// Assemble the fallback metadata.json from on-chain SVG bytes.
export function buildFallbackMetadata(type, svgBytes) {
  const meta = MEGA_META[type]
  if (!meta) return null
  return JSON.stringify({
    name: meta.name,
    description: meta.description,
    image: `data:image/svg+xml;base64,${toBase64(svgBytes)}`,
    attributes: [
      { trait_type: "Collection", value: "CinaMega" },
      { trait_type: "TokenType", value: String(type) },
      { trait_type: "Exchange Rate", value: meta.rate },
      { trait_type: "Supply", value: "Unlimited (billions)" },
    ],
  })
}

// eth_call getBackupSvgRaw(uint256) → bytes; returns decoded Uint8Array or null.
// Selector: keccak256("getBackupSvgRaw(uint256)")[0:4] = 0x3385be15
// (verified against the deployed contract; the previous placeholder value
//  made eth_call hit an unrelated selector and revert)
export const GET_BACKUP_SVG_SELECTOR = "0x3385be15"

export async function ethCallRaw(rpc, to, data) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  })
  if (!res.ok) return null
  const j = await res.json().catch(() => null)
  return j?.result ?? null
}

export function encodeGetBackupSvg(type) {
  return GET_BACKUP_SVG_SELECTOR + type.toString(16).padStart(64, "0")
}

// Sliding-window rate limiter for the chain fallback path (max 5 QPS).
export function createRateLimiter(maxPerSec = 5) {
  const calls = []
  return {
    allow() {
      const now = Date.now()
      while (calls.length && now - calls[0] > 1000) calls.shift()
      if (calls.length >= maxPerSec) return false
      calls.push(now)
      return true
    },
    size() {
      return calls.length
    },
  }
}

// Cache-Control contract aligned with public/_headers:
//   images (svg): 30 days immutable; json: 10 minutes.
export function cacheControlFor(path) {
  return path.endsWith(".json") ? "public, max-age=600" : "public, max-age=2592000, immutable"
}

export function contentTypeFor(path) {
  if (path.endsWith(".json")) return "application/json"
  if (path.endsWith(".svg")) return "image/svg+xml"
  return "application/octet-stream"
}
