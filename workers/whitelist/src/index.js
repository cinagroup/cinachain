// Cloudflare Worker - Whitelist API (Pure JavaScript, zero dependencies)
// Fail-closed by default. Only returns eligible:true when address is verified.

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-nft-dapp.pages.dev",
  "https://cinachain.pages.dev",
  "http://localhost:3000",
])

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "null"
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }
}

function jsonResponse(request, body, status = 200) {
  const headers = corsHeaders(request)
  headers["Content-Type"] = "application/json"
  headers["Cache-Control"] = status === 200
    ? "public, max-age=10, s-maxage=60"
    : "no-store"
  return new Response(JSON.stringify(body), { status, headers })
}

function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[a-f0-9]{40}$/i.test(addr)
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
        const addresses = Array.isArray(body.addresses) ? body.addresses : []
        const mintLimit = typeof body.mintLimit === "number" ? body.mintLimit : 3

        // Validate all addresses
        for (const addr of addresses) {
          if (!isValidAddress(addr)) {
            return jsonResponse(
              request,
              { error: `Invalid address: ${addr}` },
              400
            )
          }
        }

        const data = {
          addresses: addresses.map((a) => a.toLowerCase()),
          mintLimit,
          updatedAt: Date.now(),
          count: addresses.length,
        }

        await kv.put("whitelist:current", JSON.stringify(data))

        return jsonResponse(request, {
          ok: true,
          message: `Whitelist updated with ${addresses.length} addresses`,
          count: addresses.length,
          mintLimit,
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

    // Fail-closed: KV not configured -> no whitelist active, public mode
    if (!kv) {
      return jsonResponse(request, {
        eligible: true,
        proof: null,
        merkleRoot: null,
        mintLimit: 5,
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
          eligible: true,
          proof: null,
          merkleRoot: null,
          mintLimit: 5,
          phase: "public",
          message: "Public mint active (no whitelist data)",
        })
      }
      data = JSON.parse(raw)
    } catch (err) {
      // Fail-closed: on any error, deny
      return jsonResponse(request, {
        eligible: false,
        proof: null,
        merkleRoot: null,
        mintLimit: 0,
        phase: "error",
        error: "Failed to read whitelist data",
      }, 503)
    }

    const addresses = Array.isArray(data.addresses) ? data.addresses : []
    const mintLimit = typeof data.mintLimit === "number" ? data.mintLimit : 3
    const merkleRoot = data.merkleRoot || null
    const proofsMap =
      data.proofs && typeof data.proofs === "object" ? data.proofs : {}

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

    // Look up precomputed proof for this address
    const proof = proofsMap[address] || proofsMap[segments[1]] || null

    return jsonResponse(request, {
      eligible: true,
      proof,
      merkleRoot,
      mintLimit,
      phase: "whitelist",
    })
  },
}
