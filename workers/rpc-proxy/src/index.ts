// Cloudflare Worker - RPC Proxy
// Uses Cloudflare's own public ETH gateway for best compatibility

const UPSTREAM_RPCS = [
  "https://cloudflare-eth.com",
  "https://rpc.ankr.com/eth",
]

const ALLOWED_ORIGIN = "https://nft.cinachain.com"

export default {
  async fetch(request: Request): Promise<Response> {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers })
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      })
    }

    const body = await request.text()

    for (const upstream of UPSTREAM_RPCS) {
      try {
        const response = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          cf: { cacheTtl: 1 },
        })

        if (response.ok) {
          return new Response(await response.text(), {
            status: 200,
            headers,
          })
        }
      } catch {
        continue
      }
    }

    return new Response(
      JSON.stringify({ error: "All upstream RPCs failed" }),
      { status: 502, headers }
    )
  },
}
