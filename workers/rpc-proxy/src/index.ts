// Cloudflare Worker - RPC Proxy
// 解决 rpc.cinachain.com CORS 问题

export default {
  async fetch(request: Request): Promise<Response> {
    const UPSTREAM_RPC = 'https://ethereum.publicnode.com'
    const ALLOWED_ORIGIN = 'https://nft.cinachain.com'

    const headers = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers,
      })
    }

    try {
      // Forward request to upstream RPC
      const response = await fetch(UPSTREAM_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: await request.text(),
      })

      // Return response with CORS headers
      return new Response(await response.text(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Proxy failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), 
        {
          status: 500,
          headers,
        }
      )
    }
  }
}
