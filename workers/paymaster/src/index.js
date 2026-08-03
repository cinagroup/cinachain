// Cloudflare Worker — CDP Paymaster Proxy
// Hides the Coinbase Developer Platform Paymaster API key from the client.
// The frontend calls this Worker's URL; the Worker forwards to CDP with the secret key.

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-nft-dapp.pages.dev",
  "http://localhost:3000",
])

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || ""
    const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "null"

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // The CDP Paymaster URL is stored as a secret/environment variable
    const paymasterUrl = env.CDP_PAYMASTER_URL
    if (!paymasterUrl) {
      return new Response(
        JSON.stringify({ error: "Paymaster not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    try {
      const body = await request.text()
      const response = await fetch(paymasterUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })

      const data = await response.text()
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Paymaster request failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
  },
}
