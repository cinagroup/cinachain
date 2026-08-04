// workers/billing/src/index.js
// Billing gateway: API-key auth -> meter -> KV ledger -> 429.
import {
  computeUsable,
  applyConsumption,
  estimateCost,
  getTier,
  checkQuota,
  MICRO,
} from "./lib/billing-core.js"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

// Per-address in-flight mutex: serializes read-modify-write on the same
// ledger key within this isolate. KV itself is eventually consistent
// across colos, so cross-isolate races remain a documented limitation
// (M2: Durable Object / queue for strict serialization).
const inflight = new Map()

// In-memory registration rate limit: max 5 key registrations per IP per
// 10-minute window. Per-isolate only; adequate for a demo provisioning
// endpoint behind Cloudflare's global network.
const regBuckets = new Map()
function checkRegRateLimit(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const now = Math.floor(Date.now() / 600000) // 10-min window
  const k = `${ip}:${now}`
  const n = regBuckets.get(k) ?? 0
  if (n >= 5) return false
  regBuckets.set(k, n + 1)
  if (regBuckets.size > 5000) for (const [key] of regBuckets) if (!key.endsWith(`:${now}`)) regBuckets.delete(key)
  return true
}

function withLedgerLock(address, fn) {
  const prev = inflight.get(address) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  inflight.set(address, next.catch(() => {}))
  // GC: drop the resolved entry
  next.finally(() => {
    if (inflight.get(address) === next) inflight.delete(address)
  })
  return next
}

export async function handleUsage(body, ledger) {
  try {
    const tokens = BigInt(body.tokens ?? 0)
    if (tokens <= 0n) return { status: 400, body: { error: "tokens must be > 0" } }
    const tier = getTier(ledger.cumulativeSpend ?? 0n)
    const cost = estimateCost(body.model ?? "demo", tokens, tier)
    const usable = computeUsable(ledger.onchainSnapshot, ledger.committedUsage)
    if (!checkQuota(usable, cost)) {
      return { status: 429, body: { error: "Credit Insufficient", usableMicro: usable.toString() } }
    }
    const updated = applyConsumption(ledger, cost)
    const remaining = computeUsable(ledger.onchainSnapshot, updated.committedUsage)
    return { status: 200, body: { tier, chargedMicro: cost.toString(), remainingMicro: remaining.toString(), remaining: Number(remaining) / Number(MICRO) } }
  } catch (err) {
    return { status: 400, body: { error: err instanceof Error ? err.message : "Invalid request" } }
  }
}

async function hashKey(apiKey) {
  const data = new TextEncoder().encode(apiKey)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const headers = { Vary: "Origin" }
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type"
  }
  return headers
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) })

    if (url.pathname === "/health") {
      return json(request, { ok: true, service: "cinachain-billing", kvBound: !!env.CINA_BILLING_KV })
    }

    if (url.pathname === "/v1/usage" && request.method === "POST") {
      const body = await request.json().catch(() => ({}))
      const { apiKey, model, tokens } = body
      if (!apiKey) return json(request, { error: "Missing apiKey" }, 401)
      const keyRowRaw = await env.CINA_BILLING_KV.get(`key:${await hashKey(apiKey)}`)
      const keyRow = keyRowRaw ? JSON.parse(keyRowRaw) : null
      if (!keyRow) return json(request, { error: "Invalid API key" }, 401)

      // Read-modify-write on the ledger key is serialized per address;
      // the fetch layer only maps unexpected KV/JSON errors to 400.
      const res = await withLedgerLock(keyRow.address, async () => {
        try {
          const ledgerRaw = await env.CINA_BILLING_KV.get(`ledger:${keyRow.address}`)
          const stored = ledgerRaw ? JSON.parse(ledgerRaw) : {}
          const ledger = {
            onchainSnapshot: BigInt(stored.onchainSnapshot ?? 0),
            committedUsage: BigInt(stored.committedUsage ?? 0),
            cumulativeSpend: BigInt(stored.cumulativeSpend ?? 0),
          }
          const res = await handleUsage({ model, tokens }, ledger)
          if (res.status === 200) {
            const updated = applyConsumption(ledger, BigInt(res.body.chargedMicro))
            await env.CINA_BILLING_KV.put(
              `ledger:${keyRow.address}`,
              JSON.stringify({
                onchainSnapshot: stored.onchainSnapshot ?? "0",
                committedUsage: updated.committedUsage.toString(),
                cumulativeSpend: updated.cumulativeSpend.toString(),
              })
            )
          }
          return res
        } catch (err) {
          return { status: 400, body: { error: err instanceof Error ? err.message : "Invalid request" } }
        }
      })
      return json(request, res.body, res.status)
    }

    if (url.pathname.startsWith("/v1/credits/") && request.method === "GET") {
      const address = url.pathname.split("/").pop().toLowerCase()
      const raw = await env.CINA_BILLING_KV.get(`ledger:${address}`)
      const ledger = raw ? JSON.parse(raw) : null
      const onchain = ledger ? BigInt(ledger.onchainSnapshot ?? 0) : 0n
      const committed = ledger ? BigInt(ledger.committedUsage ?? 0) : 0n
      return json(request, {
        address,
        onchainSnapshot: onchain.toString(),
        committedUsage: committed.toString(),
        usable: computeUsable(onchain, committed).toString(),
        cumulativeSpend: ledger?.cumulativeSpend ?? "0",
      })
    }

    // POST /v1/keys — register an API key for an address (demo provisioning;
    // production requires SIWE-signed proof of address ownership)
    if (url.pathname === "/v1/keys" && request.method === "POST") {
      if (!checkRegRateLimit(request)) return json(request, { error: "Too many requests" }, 429)
      const body = await request.json().catch(() => ({}))
      const { apiKey, address } = body
      if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) return json(request, { error: "Invalid apiKey" }, 400)
      if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? "")) return json(request, { error: "Invalid address" }, 400)
      const hash = await hashKey(apiKey)
      await env.CINA_BILLING_KV.put(`key:${hash}`, JSON.stringify({ address: address.toLowerCase() }))
      return json(request, { ok: true, address: address.toLowerCase() })
    }

    return json(request, { error: "Not found" }, 404)
  },
}
