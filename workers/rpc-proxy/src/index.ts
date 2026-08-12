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

interface Env {
  ALCHEMY_API_KEY?: string
}

// Base Sepolia only. eth_chainId returns 0x14a34 (84532).
const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "http://localhost:3000",
])

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
        corsHeaders,
      )
    }

    // Ordered upstreams: Alchemy first (when a key is provisioned), then the
    // public endpoints as availability fallback.
    const upstreams: string[] = []
    if (env.ALCHEMY_API_KEY) {
      upstreams.push(
        `https://base-sepolia.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`,
      )
    }
    upstreams.push("https://sepolia.base.org", "https://base-sepolia.publicnode.com")

    const body = await request.text()

    for (const upstream of upstreams) {
      try {
        const response = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })

        // 200 = success; 400 = a well-formed JSON-RPC error (e.g. method not
        // found) from a healthy upstream. Pass both through — falling back on a
        // 400 would mask the real error and silently hit the public endpoint.
        // 401/403/5xx → try the next upstream (covers an invalid/expired Alchemy
        // key, allowlist rejection, or upstream outage).
        if (response.status === 200 || response.status === 400) {
          return new Response(await response.text(), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      corsHeaders,
    )
  },
}

function jsonResponse(
  obj: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export default worker
