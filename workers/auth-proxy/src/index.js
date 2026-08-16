// Cloudflare Worker — same-origin OIDC proxy for CinaAuth.
//
// The DApp is a static export on Cloudflare Pages, so the OIDC public-client
// flow (discovery / token / userinfo / jwks) runs in the browser. The CinaAuth
// worker only emits CORS headers for its own first-party origins, so browser
// calls would be blocked; this worker forwards them server-side instead.
// It is mounted at nft.cinachain.com/api/auth/* (path-preserving), which makes
// the proxy same-origin for the DApp. The authorize and end-session endpoints
// are top-level navigations and never go through here.
//
// Confidential clients (the developer console's "Web server application"
// type) authenticate token requests with client_secret_basic. The browser
// keeps a public-style request (client_id in the body, PKCE) and this worker
// injects the Authorization header server-side from CINAAUTH_CLIENT_ID /
// CINAAUTH_CLIENT_SECRET — the secret never reaches the browser bundle.
// With no secret configured the worker is a pure passthrough (public client).
//
// Forwarding semantics mirror cinaauth's @cinaauth/auth-proxy: manual
// redirects (so intermediate Set-Cookie headers survive), host/origin/referer/
// cookie headers stripped (they are not valid for the upstream), stale body
// headers dropped, responses rebuilt with no-store.

const UPSTREAM_DEFAULT = "https://auth.cinaseek.ai"
const TOKEN_ENDPOINT_PATH = "/api/auth/oauth2/token"

// Headers that describe the proxied body from the upstream hop — the worker
// runtime already decoded the stream, so copying them corrupts the response.
const STALE_BODY_HEADERS = new Set(["content-encoding", "content-length"])

// Never forward the upstream's own CORS decisions back to the caller.
const UPSTREAM_CORS_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
  "access-control-max-age",
  "access-control-allow-credentials",
  "vary",
])

// Split a combined set-cookie header without cutting Expires dates apart.
const COOKIE_BOUNDARY = /,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g

function splitSetCookieHeader(header) {
  return header
    .split(COOKIE_BOUNDARY)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
}

function parseAllowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
}

function applyCorsHeaders(request, allowedOrigins, headers) {
  const origin = request.headers.get("Origin") || ""
  headers.set("Vary", "Origin")
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    headers.set("Access-Control-Max-Age", "86400")
  }
}

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

// RFC 6749 §2.3.1: client credentials are form-encoded before being joined
// with ":" and base64'd. cinaauth's Basic parser decodes with
// decodeURIComponent, so encodeURIComponent round-trips exactly.
function clientBasicAuthHeader(clientId, clientSecret) {
  const credentials = `${encodeURIComponent(clientId)}:${encodeURIComponent(
    clientSecret
  )}`
  return `Basic ${btoa(credentials)}`
}

export default {
  async fetch(request, env) {
    const allowedOrigins = parseAllowedOrigins(env)

    if (request.method === "OPTIONS") {
      const headers = new Headers()
      applyCorsHeaders(request, allowedOrigins, headers)
      return new Response(null, { status: 204, headers })
    }

    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
      return errorResponse(405, "Method not allowed")
    }

    let upstreamBase
    try {
      upstreamBase = new URL(env.CINAAUTH_UPSTREAM || UPSTREAM_DEFAULT)
    } catch {
      return errorResponse(500, "Invalid CINAAUTH_UPSTREAM configuration")
    }

    const incoming = new URL(request.url)
    // Path-preserving forward: /api/auth/oauth2/token → upstream /api/auth/oauth2/token
    const target = new URL(incoming.pathname + incoming.search, upstreamBase)

    // Bodies are buffered instead of streamed: the proxied endpoints carry
    // small form/JSON payloads, and Request-body streams do not survive
    // re-wrapping on every runtime (undici drops them with
    // "expected non-null body source"). Manual redirects keep intermediate
    // Set-Cookie responses visible to the caller.
    const hasBody = request.method !== "GET" && request.method !== "HEAD"
    let proxied
    try {
      proxied = new Request(target, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: "manual",
      })
    } catch {
      return errorResponse(400, "Invalid request body")
    }
    proxied.headers.delete("host")
    // Same-origin browser headers that must not reach the upstream: the
    // DApp origin is not in the upstream trust list, and the OIDC endpoints
    // used here authenticate with PKCE / bearer tokens, never cookies.
    proxied.headers.delete("origin")
    proxied.headers.delete("referer")
    proxied.headers.delete("cookie")

    // Confidential client: authenticate token requests server-side. The
    // browser never sees the secret; requests already carrying credentials
    // (none today) would be left untouched.
    const clientId = env.CINAAUTH_CLIENT_ID
    const clientSecret = env.CINAAUTH_CLIENT_SECRET
    if (
      clientSecret &&
      clientId &&
      incoming.pathname === TOKEN_ENDPOINT_PATH &&
      request.method === "POST" &&
      !proxied.headers.has("authorization")
    ) {
      proxied.headers.set(
        "Authorization",
        clientBasicAuthHeader(clientId, clientSecret)
      )
    }

    let upstreamResponse
    try {
      upstreamResponse = await fetch(proxied)
    } catch {
      return errorResponse(502, "CinaAuth upstream unreachable")
    }

    const headers = new Headers()
    for (const [name, value] of upstreamResponse.headers) {
      const lower = name.toLowerCase()
      if (
        lower === "set-cookie" ||
        STALE_BODY_HEADERS.has(lower) ||
        UPSTREAM_CORS_HEADERS.has(lower)
      ) {
        continue
      }
      headers.append(name, value)
    }
    const setCookies =
      typeof upstreamResponse.headers.getSetCookie === "function"
        ? upstreamResponse.headers.getSetCookie()
        : splitSetCookieHeader(upstreamResponse.headers.get("set-cookie") || "")
    for (const setCookie of setCookies) {
      headers.append("set-cookie", setCookie)
    }
    applyCorsHeaders(request, allowedOrigins, headers)
    headers.set("Cache-Control", "no-store")

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    })
  },
}
