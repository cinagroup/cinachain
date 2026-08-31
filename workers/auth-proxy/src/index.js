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
// Only the three browser-fetched OIDC resources required by CinaChain are
// exposed. Token requests are restricted to Authorization Code + PKCE and to
// the configured client/redirect URIs before the confidential credential is
// added server-side.

const UPSTREAM_DEFAULT = "https://auth.cinaseek.ai"
const TOKEN_ENDPOINT_PATH = "/api/auth/oauth2/token"
const DISCOVERY_ENDPOINT_PATH = "/api/auth/.well-known/openid-configuration"
const USERINFO_ENDPOINT_PATH = "/api/auth/oauth2/userinfo"
const JWKS_ENDPOINT_PATH = "/api/auth/jwks"
const MAX_TOKEN_BODY_BYTES = 16 * 1024
const UPSTREAM_TIMEOUT_MS = 10_000

const ROUTES = new Map([
  [DISCOVERY_ENDPOINT_PATH, new Set(["GET", "HEAD"])],
  [TOKEN_ENDPOINT_PATH, new Set(["POST"])],
  [USERINFO_ENDPOINT_PATH, new Set(["GET", "HEAD"])],
  [JWKS_ENDPOINT_PATH, new Set(["GET", "HEAD"])],
])

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

function parseCsvSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
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

function errorResponse(request, allowedOrigins, status, message) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  applyCorsHeaders(request, allowedOrigins, headers)
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers,
  })
}

async function readBodyWithinLimit(request, maxBytes) {
  const declared = Number(request.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RangeError("Request body too large")
  }
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new RangeError("Request body too large")
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function getSingleFormValue(form, name) {
  const values = form.getAll(name)
  return values.length === 1 ? values[0] : null
}

function validateTokenForm(body, env) {
  const form = new URLSearchParams(new TextDecoder().decode(body))
  const allowedFields = new Set([
    "grant_type",
    "client_id",
    "code",
    "redirect_uri",
    "code_verifier",
  ])
  for (const key of form.keys()) {
    if (!allowedFields.has(key)) return "Unexpected token request field"
  }

  if (getSingleFormValue(form, "grant_type") !== "authorization_code") {
    return "Only the authorization_code grant is allowed"
  }
  const configuredClientId = String(env.CINAAUTH_CLIENT_ID || "")
  if (!configuredClientId) return "CinaAuth client is not configured"
  if (getSingleFormValue(form, "client_id") !== configuredClientId) {
    return "Invalid OAuth client"
  }

  const redirectUri = getSingleFormValue(form, "redirect_uri")
  if (
    !redirectUri ||
    !parseCsvSet(env.ALLOWED_REDIRECT_URIS).has(redirectUri)
  ) {
    return "Invalid OAuth redirect URI"
  }
  const code = getSingleFormValue(form, "code")
  if (!code || code.length > 4096) return "Invalid authorization code"
  const verifier = getSingleFormValue(form, "code_verifier")
  if (!verifier || verifier.length < 43 || verifier.length > 128) {
    return "Invalid PKCE code verifier"
  }
  return null
}

async function enforceRateLimit(request, env, route) {
  if (!env.AUTH_RATE_LIMITER?.limit) return true
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const result = await env.AUTH_RATE_LIMITER.limit({ key: `${ip}:${route}` })
  return result.success
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
    const allowedOrigins = parseCsvSet(env.ALLOWED_ORIGINS)
    const incoming = new URL(request.url)
    const routeMethods = ROUTES.get(incoming.pathname)

    if (!routeMethods) {
      return errorResponse(
        request,
        allowedOrigins,
        404,
        "OIDC endpoint not exposed"
      )
    }

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || ""
      if (!origin || !allowedOrigins.has(origin)) {
        return errorResponse(request, allowedOrigins, 403, "Origin not allowed")
      }
      const headers = new Headers()
      applyCorsHeaders(request, allowedOrigins, headers)
      return new Response(null, { status: 204, headers })
    }

    if (!routeMethods.has(request.method)) {
      return errorResponse(request, allowedOrigins, 405, "Method not allowed")
    }

    try {
      if (!(await enforceRateLimit(request, env, incoming.pathname))) {
        return errorResponse(
          request,
          allowedOrigins,
          429,
          "Rate limit exceeded"
        )
      }
    } catch {
      return errorResponse(
        request,
        allowedOrigins,
        503,
        "Rate limiter unavailable"
      )
    }

    let upstreamBase
    try {
      upstreamBase = new URL(env.CINAAUTH_UPSTREAM || UPSTREAM_DEFAULT)
    } catch {
      return errorResponse(
        request,
        allowedOrigins,
        500,
        "Invalid CINAAUTH_UPSTREAM configuration"
      )
    }

    const target = new URL(incoming.pathname, upstreamBase)
    if (incoming.pathname !== TOKEN_ENDPOINT_PATH)
      target.search = incoming.search

    let body
    if (incoming.pathname === TOKEN_ENDPOINT_PATH) {
      if (incoming.search) {
        return errorResponse(
          request,
          allowedOrigins,
          400,
          "Token query not allowed"
        )
      }
      const contentType = request.headers.get("Content-Type") || ""
      if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) {
        return errorResponse(
          request,
          allowedOrigins,
          415,
          "Invalid token content type"
        )
      }
      try {
        body = await readBodyWithinLimit(request, MAX_TOKEN_BODY_BYTES)
      } catch (cause) {
        const status = cause instanceof RangeError ? 413 : 400
        return errorResponse(
          request,
          allowedOrigins,
          status,
          "Invalid token request body"
        )
      }
      const validationError = validateTokenForm(body, env)
      if (validationError) {
        const status = validationError.includes("not configured") ? 503 : 400
        return errorResponse(request, allowedOrigins, status, validationError)
      }
    }

    let proxied
    try {
      const headers = new Headers(request.headers)
      headers.delete("authorization")
      if (
        incoming.pathname === USERINFO_ENDPOINT_PATH &&
        /^Bearer\s+\S+$/i.test(request.headers.get("Authorization") || "")
      ) {
        headers.set("Authorization", request.headers.get("Authorization"))
      }
      proxied = new Request(target, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
    } catch {
      return errorResponse(request, allowedOrigins, 400, "Invalid request")
    }
    proxied.headers.delete("host")
    // Same-origin browser headers that must not reach the upstream: the
    // DApp origin is not in the upstream trust list, and the OIDC endpoints
    // used here authenticate with PKCE / bearer tokens, never cookies.
    proxied.headers.delete("origin")
    proxied.headers.delete("referer")
    proxied.headers.delete("cookie")

    if (
      incoming.pathname === USERINFO_ENDPOINT_PATH &&
      !proxied.headers.has("authorization")
    ) {
      return errorResponse(
        request,
        allowedOrigins,
        401,
        "Bearer token required"
      )
    }

    // Confidential client: authenticate validated code exchanges server-side.
    // Any caller-supplied Authorization header was removed above.
    const clientId = env.CINAAUTH_CLIENT_ID
    const clientSecret = env.CINAAUTH_CLIENT_SECRET
    if (
      clientSecret &&
      clientId &&
      incoming.pathname === TOKEN_ENDPOINT_PATH &&
      request.method === "POST"
    ) {
      proxied.headers.set(
        "Authorization",
        clientBasicAuthHeader(clientId, clientSecret)
      )
    }

    let upstreamResponse
    try {
      upstreamResponse = await fetch(proxied)
    } catch (cause) {
      const status = cause?.name === "TimeoutError" ? 504 : 502
      return errorResponse(
        request,
        allowedOrigins,
        status,
        "CinaAuth upstream unreachable"
      )
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
    applyCorsHeaders(request, allowedOrigins, headers)
    headers.set("Cache-Control", "no-store")
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    })
  },
}
