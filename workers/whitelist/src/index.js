// Cloudflare Worker - Whitelist API
// Fail-closed by default. Only returns eligible:true when address is verified.
//
// v3 security model:
//   • POST /admin/whitelist now builds a Merkle tree (leaves = keccak256 of
//     the raw 20-byte address, matching CinaNFT's
//     keccak256(abi.encodePacked(msg.sender))) and stores per-address proofs.
//   • The API advertises the contract-enforced fixed limit of 3. Dynamic
//     off-chain limits are rejected because the deployed Merkle leaf binds
//     only the address and cannot enforce them against direct contract calls.
//   • CORS: the Access-Control-Allow-Origin header is only emitted for
//     allowlisted origins (never the literal "null", which sandboxed iframes
//     could spoof).
//   • Rate limiting on the admin endpoint (KV fixed-window counter, per IP).

import { keccak_256 } from "@noble/hashes/sha3"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

// Contract hard cap — mirrors CinaNFT.sol MAX_WHITELIST_PER_ADDRESS.
// Limits above this would be advertised to users but always revert on-chain.
const MAX_WHITELIST_LIMIT = 3

// Admin endpoint: max 10 POSTs per IP per hour
const ADMIN_RATE_LIMIT = 10
const ADMIN_RATE_WINDOW_MS = 60 * 60 * 1000

// Hard cap on whitelist size (abuse protection)
const MAX_ADDRESSES = 5000
const MAX_ADMIN_BODY_BYTES = 512 * 1024
const CACHE_TTL_MS = 10_000

let currentWhitelistCache = null

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
  headers["X-Content-Type-Options"] = "nosniff"
  const isPublicLookup =
    request.method === "GET" &&
    new URL(request.url).pathname.startsWith("/whitelist/")
  headers["Cache-Control"] =
    status === 200 && isPublicLookup
      ? "public, max-age=10, s-maxage=60"
      : "no-store"
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

/** KV fixed-window rate limit; returns an explicit fail-closed state. */
async function checkRateLimit(env, request) {
  const kv = env && env.CINA_WHITELIST_KV
  if (!kv) return "unavailable"
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown"
    const windowStart = Math.floor(Date.now() / ADMIN_RATE_WINDOW_MS)
    const key = `ratelimit:admin:${ip}:${windowStart}`
    const raw = await kv.get(key)
    const count = raw ? parseInt(raw, 10) : 0
    if (count >= ADMIN_RATE_LIMIT) return "blocked"
    await kv.put(key, String(count + 1), { expirationTtl: 7200 })
    return "allowed"
  } catch (err) {
    return "unavailable"
  }
}

async function readJsonWithinLimit(request, maxBytes) {
  const declared = Number(request.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RangeError("Request body too large")
  }
  if (!request.body) return null
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new RangeError("Request body too large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function readCurrentWhitelist(kv) {
  const now = Date.now()
  if (currentWhitelistCache && currentWhitelistCache.expiresAt > now) {
    return currentWhitelistCache.data
  }
  const raw = await kv.get("whitelist:current")
  const data = raw ? JSON.parse(raw) : null
  currentWhitelistCache = { data, expiresAt: now + CACHE_TTL_MS }
  return data
}

async function checkBindingRateLimit(env, request, route) {
  if (!env.WHITELIST_RATE_LIMITER?.limit) return true
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const result = await env.WHITELIST_RATE_LIMITER.limit({
    key: `${ip}:${route}`,
  })
  return result.success
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || ""
      if (!ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse(request, { error: "Origin not allowed" }, 403)
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    // Health check
    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      return jsonResponse(request, {
        ok: true,
        service: "cinachain-whitelist-api",
        version: "v3",
        kvBound: !!(env && env.CINA_WHITELIST_KV),
        timestamp: Date.now(),
      })
    }

    // Only allow GET and POST
    if (request.method !== "GET" && request.method !== "POST") {
      return jsonResponse(request, { error: "Method not allowed" }, 405)
    }

    try {
      const route = url.pathname === "/admin/whitelist" ? "admin" : "lookup"
      if (!(await checkBindingRateLimit(env, request, route))) {
        return jsonResponse(request, { error: "Too many requests" }, 429)
      }
    } catch {
      return jsonResponse(request, { error: "Rate limiter unavailable" }, 503)
    }

    // POST /admin/whitelist — upload whitelist data (admin only)
    if (request.method === "POST" && url.pathname === "/admin/whitelist") {
      // Auth check: require ADMIN_TOKEN header
      const authHeader = request.headers.get("X-Admin-Token")
      if (!env.ADMIN_TOKEN || authHeader !== env.ADMIN_TOKEN) {
        return jsonResponse(request, { error: "Unauthorized" }, 401)
      }

      // Rate limit per IP
      const adminRate = await checkRateLimit(env, request)
      if (adminRate === "blocked") {
        return jsonResponse(
          request,
          { error: "Too many requests. Try again later." },
          429
        )
      }
      if (adminRate === "unavailable") {
        return jsonResponse(
          request,
          { error: "Admin rate limiter unavailable" },
          503
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
        if (
          !/^application\/json(?:\s*;|$)/i.test(
            request.headers.get("Content-Type") || ""
          )
        ) {
          return jsonResponse(
            request,
            { error: "Content-Type must be application/json" },
            415
          )
        }
        const body = await readJsonWithinLimit(request, MAX_ADMIN_BODY_BYTES)
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return jsonResponse(request, { error: "Invalid request body" }, 400)
        }
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
            return jsonResponse(
              request,
              { error: `Invalid address: ${a}` },
              400
            )
          }
          const addr = a.toLowerCase()
          if (!seen.has(addr)) {
            seen.add(addr)
            addresses.push(addr)
          }
        }

        if (
          body.mintLimit !== undefined &&
          body.mintLimit !== MAX_WHITELIST_LIMIT
        ) {
          return jsonResponse(
            request,
            {
              error: `mintLimit must equal the on-chain limit (${MAX_WHITELIST_LIMIT})`,
            },
            400
          )
        }
        if (body.limits !== undefined) {
          if (
            !body.limits ||
            typeof body.limits !== "object" ||
            Array.isArray(body.limits)
          ) {
            return jsonResponse(
              request,
              { error: "Invalid limits object" },
              400
            )
          }
          for (const [addr, limit] of Object.entries(body.limits)) {
            if (
              !isValidAddress(addr) ||
              Number(limit) !== MAX_WHITELIST_LIMIT
            ) {
              return jsonResponse(
                request,
                {
                  error: `All limits must equal the on-chain limit (${MAX_WHITELIST_LIMIT})`,
                },
                400
              )
            }
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
          defaultLimit: MAX_WHITELIST_LIMIT,
          merkleRoot: root,
          proofs,
          updatedAt: Date.now(),
          count: addresses.length,
        }

        await kv.put("whitelist:current", JSON.stringify(data))
        currentWhitelistCache = {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        }

        return jsonResponse(request, {
          ok: true,
          message: `Whitelist updated with ${addresses.length} addresses`,
          count: addresses.length,
          merkleRoot: root,
          mintLimit: MAX_WHITELIST_LIMIT,
        })
      } catch (err) {
        const status =
          err instanceof RangeError
            ? 413
            : err instanceof SyntaxError
            ? 400
            : 500
        return jsonResponse(
          request,
          {
            error:
              status === 413
                ? "Request body too large"
                : status === 400
                ? "Failed to parse request body"
                : "Failed to update whitelist",
          },
          status
        )
      }
    }

    // All remaining routes require GET
    if (request.method !== "GET") {
      return jsonResponse(request, { error: "Method not allowed" }, 405)
    }

    const routeMatch = /^\/whitelist\/(0x[a-fA-F0-9]{40})$/.exec(url.pathname)
    if (!routeMatch) {
      return jsonResponse(request, { error: "Not found" }, 404)
    }

    const address = routeMatch[1].toLowerCase()

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
      data = await readCurrentWhitelist(kv)
      if (!data) {
        return jsonResponse(request, {
          eligible: false,
          proof: null,
          merkleRoot: null,
          mintLimit: 0,
          phase: "public",
          message: "Public mint active (no whitelist data)",
        })
      }
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

    const merkleRoot = data.merkleRoot || null
    const proofsMap =
      data.proofs && typeof data.proofs === "object" ? data.proofs : {}
    const isInWhitelist = Object.prototype.hasOwnProperty.call(
      proofsMap,
      address
    )

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

    // The deployed contract enforces a fixed maximum of 3. Returning a lower
    // off-chain number would be cosmetic and bypassable via direct calls.
    const proof = proofsMap[address] || null

    return jsonResponse(request, {
      eligible: true,
      proof,
      merkleRoot,
      mintLimit: MAX_WHITELIST_LIMIT,
      phase: "whitelist",
    })
  },
}
