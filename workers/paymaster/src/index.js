// Cloudflare Worker — CDP Paymaster Proxy
// Hides the Coinbase Developer Platform Paymaster API key from the client.
// The frontend calls this Worker's URL; the Worker forwards to CDP with the secret key.
//
// v2 hardening:
//   • CORS: ACAO is only emitted for allowlisted origins (never "null")
//   • JSON body size cap (userOps are small; huge bodies are abuse)
//   • UserOp shape validation before forwarding (must be a plausible 4337 userOp)
//   • In-memory per-IP rate limiting (per-isolate burst protection)

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

const MAX_BODY_BYTES = 16 * 1024

// Simple fixed-window counter per IP (per-isolate; not globally exact,
// but stops single-IP bursts from one edge).
const RATE_LIMIT_PER_WINDOW = 60
const RATE_WINDOW_MS = 60 * 1000
const rateBuckets = new Map()

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const headers = { Vary: "Origin" }
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type"
    headers["Access-Control-Max-Age"] = "86400"
  }
  return headers
}

function respond(request, body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  })
}

function isRateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const now = Date.now()
  const windowStart = Math.floor(now / RATE_WINDOW_MS)
  const key = `${ip}:${windowStart}`
  const count = rateBuckets.get(key) || 0
  if (count >= RATE_LIMIT_PER_WINDOW) return true
  rateBuckets.set(key, count + 1)
  // Opportunistic cleanup of stale buckets
  if (rateBuckets.size > 10000) {
    for (const [k] of rateBuckets) {
      if (!k.endsWith(`:${windowStart}`)) rateBuckets.delete(k)
    }
  }
  return false
}

/** Minimal 4337 userOp plausibility check (v0.6/v0.7 compatible fields) */
function isPlausibleUserOp(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false
  if (typeof obj.sender !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(obj.sender)) {
    return false
  }
  if (typeof obj.nonce === "undefined" && typeof obj.nonceHex === "undefined") {
    return false
  }
  return typeof obj.callData === "string" && obj.callData.startsWith("0x")
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    // Standardized health check (matches billing/whitelist/media-gateway).
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return respond(request, {
        ok: true,
        service: "cinachain-paymaster-api",
        paymasterConfigured: !!env.CDP_PAYMASTER_URL,
      })
    }

    if (request.method !== "POST") {
      return respond(request, { error: "Method not allowed" }, 405)
    }

    if (isRateLimited(request)) {
      return respond(request, { error: "Too many requests" }, 429)
    }

    const paymasterUrl = env.CDP_PAYMASTER_URL
    if (!paymasterUrl) {
      return respond(request, { error: "Paymaster not configured" }, 503)
    }

    // The key is embedded in the URL — refuse plaintext transports
    try {
      if (new URL(paymasterUrl).protocol !== "https:") {
        return respond(request, { error: "Paymaster URL must be https" }, 503)
      }
    } catch {
      return respond(request, { error: "Paymaster URL is invalid" }, 503)
    }

    try {
      const body = await request.text()
      if (body.length === 0) {
        return respond(request, { error: "Empty request body" }, 400)
      }
      if (body.length > MAX_BODY_BYTES) {
        return respond(request, { error: "Request body too large" }, 413)
      }

      // Validate shape before forwarding (blocks non-userOp junk traffic)
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        return respond(request, { error: "Invalid JSON" }, 400)
      }
      // Accept either a raw userOp or { userOp: {...} } — guard null bodies
      const userOp = parsed && typeof parsed === "object" ? (parsed.userOp ?? parsed) : null
      if (!isPlausibleUserOp(userOp)) {
        return respond(request, { error: "Invalid userOp payload" }, 400)
      }

      const response = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })

      const data = await response.text()
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      })
    } catch (err) {
      return respond(request, { error: "Paymaster request failed" }, 502)
    }
  },
}
