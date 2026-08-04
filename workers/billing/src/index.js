// workers/billing/src/index.js
// Billing gateway: API-key auth -> meter -> KV ledger -> 429.
import {
  computeUsable,
  applyConsumption,
  estimateCost,
  getTier,
  checkQuota,
  costToWei,
  tiersEarned,
  tierProgress,
  tierBadgeId,
} from "./lib/billing-core.js"
import { runIndexer, listAllKeys } from "./lib/indexer-run.js"

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

/** Tiers earned but not yet minted (spec §5: platform mints on crossing) */
export function computePendingBadges(cumulativeSpend, mintedTierBadges = []) {
  return tiersEarned(cumulativeSpend).filter((t) => !mintedTierBadges.includes(t))
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

// Lazy on-chain balance sync: per-address in-memory cache (30s TTL) so
// ledger reads don't hit the RPC on every request. We refresh inside the
// ledger lock, so the snapshot a request charges against is not stale
// relative to concurrent writes for the same address.
const snapshotCache = new Map()
const SNAPSHOT_TTL = 30_000

// Returns the fresh on-chain balance in wei, or null when the RPC is
// unreachable — callers then fall back to the ledger-stored snapshot.
async function refreshSnapshot(env, address) {
  const cached = snapshotCache.get(address)
  if (cached && Date.now() - cached.ts < SNAPSHOT_TTL) return cached.value
  try {
    const balance = await fetchBalance(env, address)
    snapshotCache.set(address, { value: balance, ts: Date.now() })
    return balance
  } catch {
    return null
  }
}

// No viem in the Worker — raw eth_call against balanceOf(address).
async function fetchBalance(env, address) {
  const rpc = env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  const selector = "0x70a08231" // balanceOf(address)
  const data = selector + address.slice(2).toLowerCase().padStart(64, "0")
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: env.CINA_CREDIT_ADDRESS, data }],
      id: 1,
    }),
  })
  const j = await res.json()
  if (!j.result) throw new Error("balanceOf failed")
  return BigInt(j.result)
}

// Ledger is wei-unit throughout (matches the ERC-20 on-chain balance):
// onchainSnapshot / committedUsage / cumulativeSpend are all wei.
// Pricing stays in micro-credit; the worker boundary converts via costToWei.
export async function handleUsage(body, ledger) {
  try {
    const tokens = BigInt(body.tokens ?? 0)
    if (tokens <= 0n) return { status: 400, body: { error: "tokens must be > 0" } }
    const costMicro = estimateCost(body.model ?? "demo", tokens, getTier(ledger.cumulativeSpend ?? 0n))
    const costWei = costToWei(costMicro)
    const usable = computeUsable(ledger.onchainSnapshot, ledger.committedUsage)
    if (!checkQuota(usable, costWei)) {
      return { status: 429, body: { error: "Credit Insufficient", usableWei: usable.toString() } }
    }
    const updated = applyConsumption(ledger, costWei)
    const tier = getTier(updated.cumulativeSpend)
    const remaining = computeUsable(ledger.onchainSnapshot, updated.committedUsage)
    return {
      status: 200,
      body: {
        tier,
        pendingBadges: computePendingBadges(updated.cumulativeSpend, ledger.mintedTierBadges ?? []),
        chargedWei: costWei.toString(),
        chargedMicro: costMicro.toString(),
        remainingWei: remaining.toString(),
        remaining: Number(remaining) / 1e18,
      },
    }
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
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Key"
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
  /** Spec §4.3: cron-driven indexer keeps ledger snapshots in sync */
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runIndexer(env).catch((err) => console.error("[indexer] failed:", err?.message ?? err))
    )
  },

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

      const ledgerKey = keyRow.kind === "cust" ? `cust:${keyRow.custId}` : `ledger:${keyRow.address}`
      // lock on the same key space the write path uses (ledger:addr / cust:id)
      const lockKey = ledgerKey

      const res = await withLedgerLock(lockKey, async () => {
        try {
          const ledgerRaw = await env.CINA_BILLING_KV.get(ledgerKey)
          const stored = ledgerRaw ? JSON.parse(ledgerRaw) : {}
          let snapshot
          if (keyRow.kind === "cust") {
            // DB-backed balance — the pool holds the real tokens (spec §6.1)
            snapshot = BigInt(stored.balanceWei ?? 0)
          } else {
            snapshot = (await refreshSnapshot(env, keyRow.address)) ?? BigInt(stored.onchainSnapshot ?? 0)
          }
          const ledger = {
            onchainSnapshot: snapshot,
            committedUsage: BigInt(stored.committedUsage ?? 0),
            cumulativeSpend: BigInt(stored.cumulativeSpend ?? 0),
            mintedTierBadges: stored.mintedTierBadges ?? [],
          }
          const res = await handleUsage({ model, tokens }, ledger)
          if (res.status === 200) {
            const updated = applyConsumption(ledger, BigInt(res.body.chargedWei))
            const merged = {
              ...stored,
              committedUsage: updated.committedUsage.toString(),
              cumulativeSpend: updated.cumulativeSpend.toString(),
              tier: res.body.tier,
              pendingTierBadges: res.body.pendingBadges,
            }
            if (keyRow.kind === "cust") {
              // balanceWei (DB) unchanged by consumption; usage is committed
              await env.CINA_BILLING_KV.put(ledgerKey, JSON.stringify(merged))
            } else {
              await env.CINA_BILLING_KV.put(ledgerKey, JSON.stringify({
                ...merged,
                onchainSnapshot: snapshot.toString(),
              }))
            }
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
      const res = await withLedgerLock(address, async () => {
        try {
          const raw = await env.CINA_BILLING_KV.get(`ledger:${address}`)
          const ledger = raw ? JSON.parse(raw) : null
          const onchain = (await refreshSnapshot(env, address)) ?? (ledger ? BigInt(ledger.onchainSnapshot ?? 0) : 0n)
          const committed = ledger ? BigInt(ledger.committedUsage ?? 0) : 0n
          const usable = computeUsable(onchain, committed)
          return {
            address,
            onchainSnapshot: onchain.toString(),
            committedUsage: committed.toString(),
            usable: usable.toString(),
            cumulativeSpend: ledger?.cumulativeSpend ?? "0",
            usableCredit: Number(usable) / 1e18,
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Invalid request" }
        }
      })
      return json(request, res)
    }

    if (url.pathname.startsWith("/v1/tier/") && request.method === "GET") {
      const address = url.pathname.split("/").pop().toLowerCase()
      const res = await withLedgerLock(address, async () => {
        try {
          const raw = await env.CINA_BILLING_KV.get(`ledger:${address}`)
          const ledger = raw ? JSON.parse(raw) : null
          const spend = ledger ? BigInt(ledger.cumulativeSpend ?? 0) : 0n
          const progress = tierProgress(spend)
          return {
            address,
            tier: progress.tier,
            cumulativeSpend: spend.toString(),
            nextTier: progress.nextTier,
            nextThreshold: progress.nextMin,
            progressBps: progress.progressBps,
            pendingBadges: ledger?.pendingTierBadges ?? [],
            mintedBadges: ledger?.mintedTierBadges ?? [],
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Invalid request" }
        }
      })
      return json(request, res)
    }

    // ── Custodial accounts (spec §6.1: hot wallet pool + DB bookkeeping) ──
    if (url.pathname === "/v1/custodial/accounts" && request.method === "POST") {
      const body = await request.json().catch(() => ({}))
      const { owner } = body
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner ?? "")) return json(request, { error: "Invalid owner" }, 400)
      const id = `cust_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
      await env.CINA_BILLING_KV.put(`cust:${id}`, JSON.stringify({
        owner: owner.toLowerCase(),
        balanceWei: "0",
        committedUsage: "0",
        cumulativeSpend: "0",
        pendingTierBadges: [],
        mintedTierBadges: [],
        createdAt: Date.now(),
      }))
      return json(request, { ok: true, id })
    }

    if (url.pathname === "/v1/custodial/credit" && request.method === "POST") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const body = await request.json().catch(() => ({}))
      const { id, amountWei } = body
      const key = `cust:${id ?? ""}`
      const res = await withLedgerLock(key, async () => {
        const raw = await env.CINA_BILLING_KV.get(key)
        const ledger = raw ? JSON.parse(raw) : null
        if (!ledger) return { error: "Account not found" }
        const add = BigInt(amountWei ?? 0)
        if (add <= 0n) return { error: "amountWei must be > 0" }
        ledger.balanceWei = (BigInt(ledger.balanceWei ?? 0) + add).toString()
        await env.CINA_BILLING_KV.put(key, JSON.stringify(ledger))
        return { ok: true, balanceWei: ledger.balanceWei }
      })
      return json(request, res)
    }

    if (url.pathname.startsWith("/v1/custodial/") && request.method === "GET") {
      const id = url.pathname.split("/").pop()
      const raw = await env.CINA_BILLING_KV.get(`cust:${id}`)
      if (!raw) return json(request, { error: "Account not found" }, 404)
      const ledger = JSON.parse(raw)
      const balance = BigInt(ledger.balanceWei ?? 0)
      const committed = BigInt(ledger.committedUsage ?? 0)
      const usable = computeUsable(balance, committed)
      return json(request, {
        id,
        owner: ledger.owner,
        balanceWei: balance.toString(),
        committedUsage: committed.toString(),
        usable: usable.toString(),
        usableCredit: Number(usable) / 1e18,
        cumulativeSpend: ledger.cumulativeSpend ?? "0",
        tier: getTier(BigInt(ledger.cumulativeSpend ?? 0)),
        pendingBadges: ledger.pendingTierBadges ?? [],
      })
    }

    // POST /v1/keys — register an API key bound to an address (self-managed)
    // or to a custodial account (spec §6.1); demo provisioning, production
    // requires SIWE-signed proof of address ownership
    if (url.pathname === "/v1/keys" && request.method === "POST") {
      if (!checkRegRateLimit(request)) return json(request, { error: "Too many requests" }, 429)
      const body = await request.json().catch(() => ({}))
      const { apiKey, address, custId } = body
      if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) return json(request, { error: "Invalid apiKey" }, 400)
      const hash = await hashKey(apiKey)
      if (address) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return json(request, { error: "Invalid address" }, 400)
        await env.CINA_BILLING_KV.put(`key:${hash}`, JSON.stringify({ kind: "self", address: address.toLowerCase() }))
        return json(request, { ok: true, address: address.toLowerCase() })
      }
      if (custId) {
        const custRaw = await env.CINA_BILLING_KV.get(`cust:${custId}`)
        if (!custRaw) return json(request, { error: "Custodial account not found" }, 404)
        await env.CINA_BILLING_KV.put(`key:${hash}`, JSON.stringify({ kind: "cust", custId }))
        return json(request, { ok: true, custId })
      }
      return json(request, { error: "address or custId required" }, 400)
    }

    // Admin: list addresses with pending tier badges (spec §5 minting flow)
    if (url.pathname === "/v1/admin/pending-badges" && request.method === "GET") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const keys = await listAllKeys(env.CINA_BILLING_KV, "ledger:")
      const pending = []
      for (const { name } of keys) {
        const raw = await env.CINA_BILLING_KV.get(name)
        if (!raw) continue
        let ledger
        try {
          ledger = JSON.parse(raw)
        } catch (err) {
          // One malformed row (e.g. manual/console edit) must not abort the
          // admin listing — skip it and carry on (mirrors indexer-run.js).
          console.error(`[admin] skipping malformed ledger row ${name}:`, err?.message ?? err)
          continue
        }
        const badges = (ledger.pendingTierBadges ?? []).filter((t) => tierBadgeId(t) !== null)
        if (badges.length) {
          pending.push({
            address: name.slice("ledger:".length),
            badges,
            cumulativeSpend: ledger.cumulativeSpend ?? "0",
          })
        }
      }
      return json(request, { pending })
    }

    // Admin: confirm a badge was minted on-chain (moves pending -> minted)
    const confirmMatch = url.pathname.match(/^\/v1\/admin\/badges\/(0x[a-fA-F0-9]{40})\/([a-z]+)\/confirm$/)
    if (confirmMatch && request.method === "POST") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const [, address, tier] = confirmMatch
      if (tierBadgeId(tier) === null) return json(request, { error: "Invalid tier" }, 400)
      const body = await request.json().catch(() => ({}))
      const key = `ledger:${address.toLowerCase()}`
      const res = await withLedgerLock(address.toLowerCase(), async () => {
        const raw = await env.CINA_BILLING_KV.get(key)
        let ledger
        if (raw) {
          try {
            ledger = JSON.parse(raw)
          } catch {
            return { error: "Ledger data corrupted" }
          }
        } else {
          ledger = {}
        }
        const minted = [...new Set([...(ledger.mintedTierBadges ?? []), tier])]
        await env.CINA_BILLING_KV.put(key, JSON.stringify({
          ...ledger,
          pendingTierBadges: (ledger.pendingTierBadges ?? []).filter((t) => t !== tier),
          mintedTierBadges: minted,
          badgeTxHashes: { ...(ledger.badgeTxHashes ?? {}), [tier]: body.txHash ?? null },
        }))
        return { ok: true, address, tier }
      })
      return json(request, res)
    }

    // Manual indexer trigger (admin key; also used by tests/E2E)
    if (url.pathname === "/v1/admin/index" && request.method === "POST") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const res = await runIndexer(env).catch((err) => ({ error: err instanceof Error ? err.message : "indexer failed" }))
      return json(request, res)
    }

    return json(request, { error: "Not found" }, 404)
  },
}
