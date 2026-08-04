// Cloudflare Worker - Whitelist API
// Fail-closed by default. Only returns eligible:true when address is verified.
//
// v2 changes:
//   • POST /admin/whitelist now builds a Merkle tree (leaves = keccak256 of
//     the raw 20-byte address, matching CinaNFT's
//     keccak256(abi.encodePacked(msg.sender))) and stores per-address proofs.
//   • Per-address mint limits (body.limits map) instead of a single limit.
//   • CORS: the Access-Control-Allow-Origin header is only emitted for
//     allowlisted origins (never the literal "null", which sandboxed iframes
//     could spoof).
//   • Rate limiting on the admin endpoint (KV fixed-window counter, per IP).

import { keccak_256 } from "@noble/hashes/sha3"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-nft-dapp.pages.dev",
  "https://cinachain-dapp-v2.pages.dev",
  "https://cinachain.pages.dev",
  "http://localhost:3000",
])

// Admin endpoint: max 10 POSTs per IP per hour
const ADMIN_RATE_LIMIT = 10
const ADMIN_RATE_WINDOW_MS = 60 * 60 * 1000

// Hard cap on whitelist size (abuse protection)
const MAX_ADDRESSES = 5000

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const headers = { Vary: "Origin" }
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
    headers["Access-Control-Max-Age"] = "86400"
  }
  return headers
}

function jsonResponse(request, body, status = 200) {
  const headers = corsHeaders(request)
  headers["Content-Type"] = "application/json"
  headers["Cache-Control"] =
    status === 200 ? "public, max-age=10, s-maxage=60" : "no-store"
  return new Response(JSON.stringify(body), { status, headers })
}

function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[a-f0-9]{40}$/i.test(addr)
}

// ─────────────────────────── Merkle helpers ───────────────────────────
// Semantics match @openzeppelin/merkle-tree + Solidity MerkleProof:
//   • leaf = keccak256(20 raw address bytes)  (== abi.encodePacked(address))
//   • pairs are sorted before hashing (bytes32 lexicographic == hex string)
//   • odd levels: last node is paired with itself

function bytesToHex(bytes) {
  let out = "0x"
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, "")
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

/** keccak256(abi.encodePacked(address)) — hash of the raw 20-byte address */
function hashLeaf(address) {
  return bytesToHex(keccak_256(hexToBytes(address)))
}

/** keccak256 of the sorted concatenation of two bytes32 */
function hashPair(a, b) {
  const [x, y] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a]
  return bytesToHex(keccak_256(hexToBytes(x + y.slice(2))))
}

/** Build the full tree; returns { levels, root } */
function buildMerkleTree(leaves) {
  const levels = [leaves]
  let layer = leaves
  while (layer.length > 1) {
    const next = []
    for (let i = 0; i < layer.length; i += 2) {
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i]
      next.push(hashPair(layer[i], right))
    }
    levels.push(next)
    layer = next
  }
  return { levels, root: layer[0] }
}

/** Merkle proof path for a leaf (OZ-compatible, self-pair for odd levels) */
function getProof(levels, leaf) {
  let idx = levels[0].indexOf(leaf)
  if (idx === -1) return null
  const proof = []
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l]
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1
    proof.push(siblingIdx < level.length ? level[siblingIdx] : level[idx])
    idx = Math.floor(idx / 2)
  }
  return proof
}

/** KV fixed-window rate limit; returns true when allowed */
async function checkRateLimit(env, request) {
  const kv = env && env.CINA_WHITELIST_KV
  if (!kv) return true // KV missing → fail-open on rate limiting (auth still gates)
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const windowStart = Math.floor(Date.now() / ADMIN_RATE_WINDOW_MS)
  const key = `ratelimit:admin:${ip}:${windowStart}`
  const raw = await kv.get(key)
  const count = raw ? parseInt(raw, 10) : 0
  if (count >= ADMIN_RATE_LIMIT) return false
  await kv.put(key, String(count + 1), { expirationTtl: 7200 })
  return true
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse(request, {
        ok: true,
        service: "cinachain-whitelist-api",
        version: "v2",
        kvBound: !!(env && env.CINA_WHITELIST_KV),
        timestamp: Date.now(),
      })
    }

    // Only allow GET and POST
    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse(request, { error: "Method not allowed" }, 405)
    }

    // POST /admin/whitelist — upload whitelist data (admin only)
    if (request.method === "POST" && url.pathname === "/admin/whitelist") {
      // Auth check: require ADMIN_TOKEN header
      const authHeader = request.headers.get("X-Admin-Token")
      if (!env.ADMIN_TOKEN || authHeader !== env.ADMIN_TOKEN) {
        return jsonResponse(request, { error: "Unauthorized" }, 401)
      }

      // Rate limit per IP
      if (!(await checkRateLimit(env, request))) {
        return jsonResponse(
          request,
          { error: "Too many requests. Try again later." },
          429
        )
      }

      const kv = env && env.CINA_WHITELIST_KV
      if (!kv) {
        return jsonResponse(
          request,
          { error: "KV not configured. Bind CINA_WHITELIST_KV namespace." },
          503
        )
      }

      try {
        const body = await request.json()
        const rawAddresses = Array.isArray(body.addresses) ? body.addresses : []
        if (rawAddresses.length === 0) {
          return jsonResponse(request, { error: "No addresses provided" }, 400)
        }
        if (rawAddresses.length > MAX_ADDRESSES) {
          return jsonResponse(
            request,
            { error: `Too many addresses (max ${MAX_ADDRESSES})` },
            400
          )
        }

        // Validate + dedupe addresses
        const seen = new Set()
        const addresses = []
        for (const a of rawAddresses) {
          if (!isValidAddress(a)) {
            return jsonResponse(request, { error: `Invalid address: ${a}` }, 400)
          }
          const addr = a.toLowerCase()
          if (!seen.has(addr)) {
            seen.add(addr)
            addresses.push(addr)
          }
        }

        // Per-address mint limits (default 3, bounded 1..10)
        const defaultLimit =
          typeof body.mintLimit === "number" &&
          Number.isInteger(body.mintLimit) &&
          body.mintLimit >= 1 &&
          body.mintLimit <= 10
            ? body.mintLimit
            : 3
        const limits = {}
        if (body.limits && typeof body.limits === "object") {
          for (const [addr, lim] of Object.entries(body.limits)) {
            const a = addr.toLowerCase()
            if (!isValidAddress(a)) continue
            const l = Number(lim)
            if (Number.isInteger(l) && l >= 1 && l <= 10) limits[a] = l
          }
        }

        // Build Merkle tree: leaves = keccak256(20 raw address bytes)
        const leaves = addresses.map(hashLeaf)
        const { levels, root } = buildMerkleTree(leaves)
        const proofs = {}
        addresses.forEach((addr, i) => {
          proofs[addr] = getProof(levels, leaves[i])
        })

        const data = {
          addresses,
          limits,
          defaultLimit,
          merkleRoot: root,
          proofs,
          updatedAt: Date.now(),
          count: addresses.length,
        }

        await kv.put("whitelist:current", JSON.stringify(data))

        return jsonResponse(request, {
          ok: true,
          message: `Whitelist updated with ${addresses.length} addresses`,
          count: addresses.length,
          merkleRoot: root,
          mintLimit: defaultLimit,
        })
      } catch (err) {
        return jsonResponse(
          request,
          { error: "Failed to parse request body" },
          400
        )
      }
    }

    // All remaining routes require GET
    if (request.method !== "GET") {
      return jsonResponse(request, { error: "Method not allowed" }, 405)
    }

    // Parse: /whitelist/:address
    const segments = url.pathname.split("/").filter(Boolean)
    if (segments[0] !== "whitelist") {
      return jsonResponse(request, { error: "Not found" }, 404)
    }

    const address = segments[1]?.toLowerCase()
    if (!address || !isValidAddress(address)) {
      return jsonResponse(
        request,
        { error: "Invalid address", expected: "/whitelist/0x..." },
        400
      )
    }

    const kv = env && env.CINA_WHITELIST_KV

    // Fail-open to public: KV not configured -> no whitelist active
    if (!kv) {
      return jsonResponse(request, {
        eligible: false,
        proof: null,
        merkleRoot: null,
        mintLimit: 0,
        phase: "public",
        message: "Public mint active (whitelist not configured)",
      })
    }

    // KV configured - read whitelist data
    let data
    try {
      const raw = await kv.get("whitelist:current")
      if (!raw) {
        return jsonResponse(request, {
          eligible: false,
          proof: null,
          merkleRoot: null,
          mintLimit: 0,
          phase: "public",
          message: "Public mint active (no whitelist data)",
        })
      }
      data = JSON.parse(raw)
    } catch (err) {
      // Fail-closed: on any error, deny
      return jsonResponse(
        request,
        {
          eligible: false,
          proof: null,
          merkleRoot: null,
          mintLimit: 0,
          phase: "error",
          error: "Failed to read whitelist data",
        },
        503
      )
    }

    const addresses = Array.isArray(data.addresses) ? data.addresses : []
    const defaultLimit =
      typeof data.defaultLimit === "number" ? data.defaultLimit : 3
    const merkleRoot = data.merkleRoot || null
    const proofsMap =
      data.proofs && typeof data.proofs === "object" ? data.proofs : {}
    const limitsMap =
      data.limits && typeof data.limits === "object" ? data.limits : {}

    const normalized = addresses.map((a) => String(a).toLowerCase())
    const isInWhitelist = normalized.includes(address)

    if (!isInWhitelist) {
      return jsonResponse(request, {
        eligible: false,
        proof: null,
        merkleRoot,
        mintLimit: 0,
        phase: "whitelist",
        message: "Address not in whitelist",
      })
    }

    // Look up precomputed proof + per-address limit
    const proof = proofsMap[address] || proofsMap[segments[1]] || null
    const mintLimit = limitsMap[address] ?? defaultLimit

    return jsonResponse(request, {
      eligible: true,
      proof,
      merkleRoot,
      mintLimit,
      phase: "whitelist",
    })
  },
}
