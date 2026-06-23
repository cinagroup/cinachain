// Cloudflare Worker - Whitelist API (Simplified)
// Returns public mint status (no whitelist check until KV is configured)

const ALLOWED_ORIGIN = "https://nft.cinachain.com"

export interface Env {
  CINA_WHITELIST_KV?: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const address = url.pathname.split("/")[2]?.toLowerCase()

    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers })
    }

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return new Response(
        JSON.stringify({ error: "Invalid address" }),
        { status: 400, headers }
      )
    }

    // Check if KV is configured
    if (!env.CINA_WHITELIST_KV) {
      // No KV - return public mint status (not eligible for whitelist)
      return Response.json(
        {
          eligible: false,
          proof: null,
          mintLimit: 0,
          message: "Whitelist not configured - public mint only",
        },
        { headers }
      )
    }

    // KV configured - check whitelist
    const whitelistData = await env.CINA_WHITELIST_KV.get(
      "whitelist:current",
      "json"
    )

    if (!whitelistData) {
      return Response.json(
        {
          eligible: false,
          proof: null,
          mintLimit: 0,
          message: "Whitelist data not found",
        },
        { headers }
      )
    }

    const { addresses, mintLimit } = whitelistData as {
      addresses: string[]
      mintLimit: number
    }

    const normalizedAddress = address.toLowerCase()
    const normalizedAddresses = addresses.map((a: string) => a.toLowerCase())
    const isInWhitelist = normalizedAddresses.includes(normalizedAddress)

    if (!isInWhitelist) {
      return Response.json(
        { eligible: false, proof: null, mintLimit: 0 },
        { headers }
      )
    }

    // Generate Merkle Proof (simplified - would need merkletreejs in production)
    return Response.json(
      {
        eligible: true,
        proof: [],
        merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
        mintLimit: mintLimit || 3,
      },
      { headers }
    )
  },
}
