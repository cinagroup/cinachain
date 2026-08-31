// CinaMega media gateway worker — R2 → 4EVERLAND → on-chain SVG → 503.
// Serves `/<cid>/metadata.json` and `/<cid>/<name>.svg` for the CinaMega
// collections. The chain fallback only fires when both R2 and the
// 4EVERLAND gateway fail, and each tokenType triggers at most one chain
// call (write-through caching to R2).
import {
  buildFallbackMetadata,
  cacheControlFor,
  contentTypeFor,
  createRateLimiter,
  decodeBytesReturn,
  encodeGetBackupSvg,
  ethCallRaw,
  extractCidPath,
  isAllowedMediaPath,
  maxMediaBytes,
  parseCidMap,
  readResponseWithinLimit,
  validateMediaBytes,
} from "./lib/gateway-core.js"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

const chainLimiter = createRateLimiter(5)

function corsHeaders(request) {
  const origin = request.headers.get("Origin")
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    }
  }
  return { Vary: "Origin" }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  })
}

async function handleHealth(request) {
  return json(
    { ok: true, service: "cinachain-mega-media", version: "1.0.0" },
    200,
    corsHeaders(request)
  )
}

async function handleMedia(request, env) {
  const parsed = extractCidPath(new URL(request.url).pathname)
  if (!parsed)
    return json({ error: "expected /<cid>/<path>" }, 404, corsHeaders(request))
  const { cid, path } = parsed
  const key = `${cid}/${path}`
  const type = parseCidMap(env.MEGA_TYPE_CIDS)[cid]
  if (!type || !isAllowedMediaPath(type, path)) {
    return json({ error: "media asset not found" }, 404, corsHeaders(request))
  }

  // Layer 1 — R2 hit (normal path)
  const cached = await env.CINA_MEGA_MEDIA.get(key).catch(() => null)
  if (cached) {
    if (Number(cached.size) > maxMediaBytes(path)) {
      return json({ error: "cached media invalid" }, 503, corsHeaders(request))
    }
    return new Response(cached.body, {
      headers: {
        "Content-Type": contentTypeFor(path),
        "Cache-Control": cacheControlFor(path),
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders(request),
      },
    })
  }

  // Layer 2 — 4EVERLAND origin fetch, write-through to R2
  const origin = env.FOUR_EVERLAND_GATEWAY
  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (
        originUrl.protocol !== "https:" ||
        originUrl.username ||
        originUrl.password
      ) {
        throw new Error("invalid media origin")
      }
      const up = await fetch(
        `${originUrl.href.replace(/\/$/, "")}/ipfs/${cid}/${path}`,
        {
          headers: { "User-Agent": "cinachain-mega-media/1.0" },
          redirect: "error",
          signal: AbortSignal.timeout(8_000),
        }
      )
      if (up.ok) {
        const bytes = await readResponseWithinLimit(up, maxMediaBytes(path))
        if (!validateMediaBytes(path, bytes))
          throw new Error("invalid media payload")
        await env.CINA_MEGA_MEDIA.put(key, bytes).catch(() => {})
        return new Response(bytes, {
          headers: {
            "Content-Type": contentTypeFor(path),
            "Cache-Control": cacheControlFor(path),
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request),
          },
        })
      }
    } catch {
      // fall through to the chain layer
    }
  }

  // Layer 3 — on-chain SVG fallback (rate-limited, at most once per type)
  if (type && env.CINA_MEGA_ADDRESS && env.BASE_SEPOLIA_RPC) {
    if (env.MEDIA_CHAIN_RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown"
      try {
        const result = await env.MEDIA_CHAIN_RATE_LIMITER.limit({ key: ip })
        if (!result.success) {
          return json(
            { error: "busy — chain fallback rate limited" },
            429,
            corsHeaders(request)
          )
        }
      } catch {
        return json(
          { error: "chain rate limiter unavailable" },
          503,
          corsHeaders(request)
        )
      }
    }
    if (!chainLimiter.allow()) {
      return json(
        { error: "busy — chain fallback rate limited" },
        429,
        corsHeaders(request)
      )
    }
    try {
      const hex = await ethCallRaw(
        env.BASE_SEPOLIA_RPC,
        env.CINA_MEGA_ADDRESS,
        encodeGetBackupSvg(type)
      )
      const svgBytes = decodeBytesReturn(hex)
      if (svgBytes.length > 0) {
        let body
        let ctype
        if (path.endsWith(".json")) {
          const meta = buildFallbackMetadata(type, svgBytes)
          if (!meta)
            return json(
              { error: "unknown token type" },
              503,
              corsHeaders(request)
            )
          body = new TextEncoder().encode(meta)
          ctype = "application/json"
        } else {
          body = svgBytes
          ctype = "image/svg+xml"
        }
        // Write-through: subsequent requests hit R2, one chain call per type.
        await env.CINA_MEGA_MEDIA.put(key, body).catch(() => {})
        return new Response(body, {
          headers: {
            "Content-Type": ctype,
            "Cache-Control": cacheControlFor(path),
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(request),
          },
        })
      }
    } catch {
      // fall through to 503
    }
  }

  // Layer 4 — nothing worked
  return json({ error: "media unavailable" }, 503, corsHeaders(request))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || ""
      if (!ALLOWED_ORIGINS.has(origin)) {
        return json({ error: "origin not allowed" }, 403, corsHeaders(request))
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    if (url.pathname === "/health" && request.method === "GET")
      return handleHealth(request)
    if (request.method !== "GET")
      return json({ error: "method not allowed" }, 405, corsHeaders(request))
    return handleMedia(request, env)
  },
}
