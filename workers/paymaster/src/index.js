// Cloudflare Worker — CDP Paymaster Proxy
// Hides the Coinbase Developer Platform Paymaster API key from the client.
// The frontend calls this Worker's URL; the Worker forwards to CDP with the secret key.
//
// v3 hardening:
//   • CORS: ACAO is only emitted for allowlisted origins (never "null")
//   • Streaming JSON body cap (userOps are small; huge bodies are abuse)
//   • Exact JSON-RPC method, EntryPoint and UserOp shape validation
//   • Cloudflare rate-limit binding plus per-isolate burst protection
//   • Disabled unless an operator explicitly acknowledges a restrictive CDP
//     dashboard sponsorship policy.

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

const MAX_BODY_BYTES = 16 * 1024
const PAYMASTER_PATH = "/v1/paymaster"
const ALLOWED_RPC_METHODS = new Set([
  "pm_sponsorUserOperation",
  "pm_getPaymasterStubData",
])

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
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
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
  if (
    typeof obj.sender !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/.test(obj.sender)
  ) {
    return false
  }
  if (typeof obj.nonce === "undefined" && typeof obj.nonceHex === "undefined") {
    return false
  }
  if (
    typeof obj.callData !== "string" ||
    !/^0x[a-fA-F0-9]*$/.test(obj.callData) ||
    obj.callData.length > 16_386
  ) {
    return false
  }
  for (const field of [
    "nonce",
    "callGasLimit",
    "verificationGasLimit",
    "preVerificationGas",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
  ]) {
    if (obj[field] !== undefined && !/^0x[a-fA-F0-9]{1,64}$/.test(obj[field])) {
      return false
    }
  }
  return true
}

async function readBodyWithinLimit(request) {
  const declared = Number(request.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new RangeError("Request body too large")
  }
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
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
  return new TextDecoder().decode(bytes)
}

function validateRpcPayload(parsed, expectedEntryPoint) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    parsed.jsonrpc !== "2.0" ||
    !ALLOWED_RPC_METHODS.has(parsed.method) ||
    !Array.isArray(parsed.params) ||
    parsed.params.length < 2
  ) {
    return null
  }
  const [userOp, entryPoint] = parsed.params
  if (
    typeof entryPoint !== "string" ||
    entryPoint.toLowerCase() !== expectedEntryPoint.toLowerCase() ||
    !isPlausibleUserOp(userOp)
  ) {
    return null
  }
  return userOp
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || ""
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return respond(request, { error: "Origin not allowed" }, 403)
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    // Standardized health check (matches billing/whitelist/media-gateway).
    if (request.method === "GET" && url.pathname === "/health") {
      return respond(
        request,
        {
          ok: true,
          service: "cinachain-paymaster-api",
          enabled: String(env.PAYMASTER_ENABLED).toLowerCase() === "true",
          paymasterConfigured: !!env.CDP_PAYMASTER_URL,
        },
        200
      )
    }

    if (url.pathname !== PAYMASTER_PATH) {
      return respond(request, { error: "Not found" }, 404)
    }
    if (request.method !== "POST") {
      return respond(request, { error: "Method not allowed" }, 405)
    }

    if (
      String(env.PAYMASTER_ENABLED).toLowerCase() !== "true" ||
      env.PAYMASTER_POLICY_MODE !== "cdp-dashboard-enforced"
    ) {
      return respond(
        request,
        { error: "Paymaster sponsorship is disabled" },
        503
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(env.ENTRYPOINT_ADDRESS || "")) {
      return respond(
        request,
        { error: "Paymaster policy is not configured" },
        503
      )
    }

    if (isRateLimited(request)) {
      return respond(request, { error: "Too many requests" }, 429)
    }
    if (env.PAYMASTER_RATE_LIMITER?.limit) {
      try {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown"
        const result = await env.PAYMASTER_RATE_LIMITER.limit({ key: ip })
        if (!result.success)
          return respond(request, { error: "Too many requests" }, 429)
      } catch {
        return respond(request, { error: "Rate limiter unavailable" }, 503)
      }
    }

    const paymasterUrl = env.CDP_PAYMASTER_URL
    if (!paymasterUrl) {
      return respond(request, { error: "Paymaster not configured" }, 503)
    }

    // The key is embedded in the URL — refuse plaintext transports
    try {
      const upstream = new URL(paymasterUrl)
      if (
        upstream.protocol !== "https:" ||
        upstream.hostname !== "api.developer.coinbase.com" ||
        upstream.username ||
        upstream.password
      ) {
        return respond(
          request,
          { error: "Paymaster URL is not an approved CDP endpoint" },
          503
        )
      }
    } catch {
      return respond(request, { error: "Paymaster URL is invalid" }, 503)
    }

    try {
      const body = await readBodyWithinLimit(request)
      if (body.length === 0) {
        return respond(request, { error: "Empty request body" }, 400)
      }
      // Validate the exact EIP-4337 JSON-RPC envelope before forwarding.
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        return respond(request, { error: "Invalid JSON" }, 400)
      }
      if (!validateRpcPayload(parsed, env.ENTRYPOINT_ADDRESS)) {
        return respond(
          request,
          { error: "Invalid paymaster JSON-RPC payload" },
          400
        )
      }

      const response = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      })

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...corsHeaders(request),
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (err) {
      return respond(
        request,
        {
          error:
            err instanceof RangeError
              ? "Request body too large"
              : "Paymaster request failed",
        },
        err instanceof RangeError ? 413 : 502
      )
    }
  },
}
