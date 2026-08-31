// Cloudflare Worker - RPC Proxy for Base Sepolia
//
// Proxies JSON-RPC to Alchemy (primary; key held as a Worker secret) with the
// public Base Sepolia endpoints as fallback. Serving the browser through this
// same-origin Worker eliminates two failure modes that broke direct browser
// calls to Alchemy:
//   1. Alchemy returns no `Access-Control-Allow-Origin` header when it rejects
//      a request (invalid key, referrer-allowlist mismatch, quota) — every
//      rejection surfaced as a browser CORS error, masking the real cause.
//   2. The Alchemy key was baked into the frontend bundle (leaked repeatedly
//      via CSP echoes and chat). It now lives only in this Worker's secret.
//
// Worker -> upstream is a server-side fetch, so Alchemy's referrer allowlist
// and browser CORS do not apply; the key rotates without touching the DApp.
//
// Abuse controls (the endpoint URL is public in the frontend bundle):
//   • Method allow-list — only the methods the DApp/pipelines actually use;
//     debug_*/trace_*/eth_getLogs etc. are refused before reaching Alchemy.
//   • Streaming body size cap (64 KiB); JSON-RPC batches are rejected so one
//     rate-limit unit can never fan out into many upstream operations.
//   • CORS Origin allow-list for browser callers (non-browser callers are
//     bounded by the method/body caps, not CORS).

interface Env {
  ALCHEMY_API_KEY?: string
  // Workers rate-limiting binding (see wrangler.toml [[ratelimits]])
  RPC_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

// Base Sepolia only. eth_chainId returns 0x14a34 (84532).
const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "http://localhost:3000",
])

// ─── Abuse controls ───────────────────────────────────────────────────────────
// The endpoint URL ships in the frontend bundle, so anyone can find it; these
// controls bound what a stranger can burn through our Alchemy quota.

// Only the methods the DApp (wagmi hooks) and the deploy/verify pipelines use.
// Deliberately excluded: debug_*/trace_* (compute-heavy quota burners),
// eth_getLogs (expensive over wide ranges — add back when an events feature
// needs it), eth_newFilter/eth_getFilterChanges (stateful filter abuse),
// net_version, archive/state methods nobody here calls.
const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getCode",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getBlockByNumber",
  "eth_sendRawTransaction",
])

// JSON-RPC bodies are tiny (calldata/raw tx a few KB); 64 KiB is generous.
const MAX_BODY_BYTES = 64 * 1024
interface RpcRequest {
  jsonrpc?: unknown
  method?: unknown
  params?: unknown
}

async function readBodyWithinLimit(
  request: Request,
  maxBytes: number
): Promise<string> {
  const declared = Number(request.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RangeError("Request body too large")
  }
  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
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
  return new TextDecoder().decode(bytes)
}

function validateRequest(parsed: RpcRequest): string | null {
  if (!parsed || typeof parsed !== "object" || parsed.jsonrpc !== "2.0") {
    return "Invalid JSON-RPC request"
  }
  const method = typeof parsed.method === "string" ? parsed.method : ""
  if (!ALLOWED_METHODS.has(method)) {
    return `Method not allowed through this proxy: ${method || "(missing)"}`
  }
  const params = Array.isArray(parsed.params) ? parsed.params : []
  if (method === "eth_getBlockByNumber" && params[1] !== false) {
    return "Full-transaction block responses are not allowed"
  }
  if (method === "eth_feeHistory") {
    const count = typeof params[0] === "string" ? Number(params[0]) : NaN
    if (!Number.isSafeInteger(count) || count < 1 || count > 1024) {
      return "eth_feeHistory block count exceeds 1024"
    }
  }
  return null
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? ""
    // Reflect the caller's origin only when allow-listed; otherwise default to
    // the production origin so the header is always valid (never `*` + creds,
    // never an arbitrary reflecting oracle).
    const allowOrigin = ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://nft.cinachain.com"

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    }

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({ error: "Origin not allowed" }, 403, corsHeaders)
      }
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== "POST") {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Only POST is supported" },
        },
        405,
        corsHeaders
      )
    }

    // Per-IP rate limit — checked before the body is read so throttled
    // requests cost nothing upstream. 120 req / 60 s per client IP.
    if (env.RPC_RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown"
      let success = false
      try {
        ;({ success } = await env.RPC_RATE_LIMITER.limit({ key: ip }))
      } catch {
        return jsonResponse(
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Rate limiter unavailable" },
          },
          503,
          corsHeaders
        )
      }
      if (!success) {
        return jsonResponse(
          {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32005,
              message: "Rate limit exceeded (120 req/min per IP)",
            },
          },
          429,
          { ...corsHeaders, "Retry-After": "60" }
        )
      }
    }

    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get("Content-Type") ?? ""
      )
    ) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "Content-Type must be application/json",
          },
        },
        415,
        corsHeaders
      )
    }

    let body: string
    try {
      body = await readBodyWithinLimit(request, MAX_BODY_BYTES)
    } catch (cause) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: `Request body exceeds ${MAX_BODY_BYTES} bytes`,
          },
        },
        cause instanceof RangeError ? 413 : 400,
        corsHeaders
      )
    }

    let parsed: RpcRequest
    try {
      parsed = JSON.parse(body)
    } catch {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
        corsHeaders
      )
    }

    if (Array.isArray(parsed)) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "JSON-RPC batches are not supported",
          },
        },
        400,
        corsHeaders
      )
    }

    const validationError = validateRequest(parsed)
    if (validationError) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32601,
            message: validationError,
          },
        },
        403,
        corsHeaders
      )
    }

    // Ordered upstreams: Alchemy first (when a key is provisioned), then the
    // public endpoints as availability fallback.
    const upstreams: string[] = []
    if (env.ALCHEMY_API_KEY) {
      upstreams.push(
        `https://base-sepolia.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`
      )
    }
    upstreams.push(
      "https://sepolia.base.org",
      "https://base-sepolia.publicnode.com"
    )

    for (const upstream of upstreams) {
      try {
        const response = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(10_000),
        })

        // 200 = success; 400 = a well-formed JSON-RPC error (e.g. method not
        // found) from a healthy upstream. Pass both through — falling back on a
        // 400 would mask the real error and silently hit the public endpoint.
        // 401/403/5xx → try the next upstream (covers an invalid/expired Alchemy
        // key, allowlist rejection, or upstream outage).
        if (response.status === 200 || response.status === 400) {
          return new Response(response.body, {
            status: response.status,
            headers: {
              ...corsHeaders,
              "Cache-Control": "no-store",
              "Content-Type": "application/json",
              "X-Content-Type-Options": "nosniff",
            },
          })
        }
      } catch {
        // Network error / upstream unreachable → try next.
        continue
      }
    }

    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: "All upstream RPCs failed" },
      },
      502,
      corsHeaders
    )
  },
}

function jsonResponse(
  obj: unknown,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export default worker
