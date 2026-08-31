// workers/billing/src/index.js
// Billing gateway: API-key auth -> meter -> KV ledger -> 429.
import {
  applyConsumption,
  checkQuota,
  computeUsable,
  costToWei,
  getTier,
  tierBadgeId,
  tierProgress,
  tiersEarned,
} from "./lib/billing-core.js"
import { listAllKeys, runIndexer } from "./lib/indexer-run.js"
import {
  encryptKey,
  ingressRecord,
  ingressStatusTransitions,
  validateDeclaredMicro,
} from "./lib/ingress.js"
import {
  applyPricingOverrides,
  DEFAULT_PRICING,
  estimateCostWithPricing,
} from "./lib/pricing.js"
import {
  BINDING_URI,
  CHAIN_ID,
  parseBindingMessage,
  verifyOwnership,
} from "./lib/sig-verify.js"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

const textEncoder = new TextEncoder()
const MAX_JSON_BODY_BYTES = 64 * 1024
const MAX_SNAPSHOT_CACHE_ENTRIES = 1000
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

function featureEnabled(env, name) {
  return String(env?.[name] ?? "").toLowerCase() === "true"
}

function featureUnavailable(request, feature) {
  return json(
    request,
    {
      error: `${feature} is disabled until transactional storage and authoritative metering are configured`,
    },
    503
  )
}

async function readJsonBody(request) {
  const declared = Number(request.headers.get("Content-Length"))
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    throw new RangeError("Request body too large")
  }
  if (!request.body) return {}
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_JSON_BODY_BYTES) {
        await reader.cancel()
        throw new RangeError("Request body too large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (total === 0) return {}
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes))
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("JSON object required")
  }
  return parsed
}

async function secretValue(binding) {
  if (!binding || typeof binding.get !== "function") {
    throw new Error("Secrets Store binding unavailable")
  }
  const value = await binding.get()
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Secrets Store value unavailable")
  }
  return value
}

async function sha256(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", textEncoder.encode(value))
  )
}

function timingSafeEqual(left, right) {
  return crypto.subtle.timingSafeEqual(left, right)
}

async function requireAdmin(request, env) {
  let expected
  try {
    expected = await secretValue(env.ADMIN_KEY)
  } catch {
    return json(request, { error: "Service configuration unavailable" }, 503)
  }
  if (
    expected.length < 32 ||
    /\s/.test(expected) ||
    /^(.)\1+$/.test(expected)
  ) {
    return json(request, { error: "Service configuration unavailable" }, 503)
  }

  const presented = request.headers.get("X-Admin-Key") ?? ""
  const [expectedDigest, presentedDigest] = await Promise.all([
    sha256(expected),
    sha256(presented),
  ])
  if (!timingSafeEqual(expectedDigest, presentedDigest)) {
    return json(request, { error: "Unauthorized" }, 401)
  }
  return null
}

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
  if (regBuckets.size > 5000)
    for (const [key] of regBuckets)
      if (!key.endsWith(`:${now}`)) regBuckets.delete(key)
  return true
}

// Read budget for public ingress list — separate from write registrations
// so the /keys page's list refresh doesn't exhaust the submit budget.
const readBuckets = new Map()
function checkReadRateLimit(request, limit = 20, windowMin = 10) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const now = Math.floor(Date.now() / (windowMin * 60000))
  const k = `${ip}:${now}`
  const n = readBuckets.get(k) ?? 0
  if (n >= limit) return false
  readBuckets.set(k, n + 1)
  if (readBuckets.size > 5000)
    for (const [key] of readBuckets)
      if (!key.endsWith(`:${now}`)) readBuckets.delete(key)
  return true
}

/** Tiers earned but not yet minted (spec §5: platform mints on crossing) */
export function computePendingBadges(cumulativeSpend, mintedTierBadges = []) {
  return tiersEarned(cumulativeSpend).filter(
    (t) => !mintedTierBadges.includes(t)
  )
}

function withLedgerLock(address, fn) {
  const prev = inflight.get(address) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  const tracked = next.catch(() => {})
  inflight.set(address, tracked)
  // GC: drop the resolved entry
  void tracked.finally(() => {
    if (inflight.get(address) === tracked) inflight.delete(address)
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
  if (!ADDRESS_PATTERN.test(address)) return null
  const cached = snapshotCache.get(address)
  if (cached && Date.now() - cached.ts < SNAPSHOT_TTL) {
    snapshotCache.delete(address)
    snapshotCache.set(address, cached)
    return cached.value
  }
  try {
    const balance = await fetchBalance(env, address)
    if (snapshotCache.size >= MAX_SNAPSHOT_CACHE_ENTRIES) {
      snapshotCache.delete(snapshotCache.keys().next().value)
    }
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
    signal: AbortSignal.timeout(10_000),
  })
  const j = await res.json()
  if (!j.result) throw new Error("balanceOf failed")
  return BigInt(j.result)
}

// Ledger is wei-unit throughout (matches the ERC-20 on-chain balance):
// onchainSnapshot / committedUsage / cumulativeSpend are all wei.
// Pricing stays in micro-credit; the worker boundary converts via costToWei.
export async function handleUsage(body, ledger, pricing = DEFAULT_PRICING) {
  try {
    const tokenText = String(body.tokens ?? "")
    if (!/^\d{1,8}$/.test(tokenText)) {
      return {
        status: 400,
        body: { error: "tokens must be an integer from 1 to 10000000" },
      }
    }
    const tokens = BigInt(tokenText)
    if (tokens <= 0n || tokens > 10_000_000n) {
      return {
        status: 400,
        body: { error: "tokens must be an integer from 1 to 10000000" },
      }
    }
    const costMicro = estimateCostWithPricing(
      pricing,
      body.model ?? "demo",
      tokens,
      getTier(ledger.cumulativeSpend ?? 0n)
    )
    const costWei = costToWei(costMicro)
    const usable = computeUsable(ledger.onchainSnapshot, ledger.committedUsage)
    if (!checkQuota(usable, costWei)) {
      return {
        status: 429,
        body: { error: "Credit Insufficient", usableWei: usable.toString() },
      }
    }
    const updated = applyConsumption(ledger, costWei)
    const tier = getTier(updated.cumulativeSpend)
    const remaining = computeUsable(
      ledger.onchainSnapshot,
      updated.committedUsage
    )
    return {
      status: 200,
      body: {
        tier,
        pendingBadges: computePendingBadges(
          updated.cumulativeSpend,
          ledger.mintedTierBadges ?? []
        ),
        chargedWei: costWei.toString(),
        chargedMicro: costMicro.toString(),
        remainingWei: remaining.toString(),
        remaining: Number(remaining) / 1e18,
      },
    }
  } catch (err) {
    return {
      status: 400,
      body: { error: err instanceof Error ? err.message : "Invalid request" },
    }
  }
}

async function hashKey(apiKey) {
  const data = new TextEncoder().encode(apiKey)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const headers = { Vary: "Origin" }
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Key"
  }
  return headers
}

// BigInt -> Number in the wire format: JSON cannot carry BigInt, and micro
// prices (pricing table) are the only BigInts ever put into a response body —
// far below Number.MAX_SAFE_INTEGER, so no precision loss. Everything else is
// already .toString()'d at the call site.
function json(request, body, status = 200) {
  return new Response(
    JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
    {
      status,
      headers: {
        ...corsHeaders(request),
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    }
  )
}

export default {
  /** Spec §4.3: cron-driven indexer keeps ledger snapshots in sync */
  async scheduled(_event, env, ctx) {
    if (!featureEnabled(env, "ENABLE_INDEXER")) return
    ctx.waitUntil(
      runIndexer(env).catch((err) =>
        console.error("[indexer] failed:", err?.message ?? err)
      )
    )
  },

  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.protocol === "http:") {
      url.protocol = "https:"
      return Response.redirect(url.toString(), 308)
    }

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || ""
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return json(request, { error: "Origin not allowed" }, 403)
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, {
        ok: true,
        service: "cinachain-billing",
        kvBound: !!env.CINA_BILLING_KV,
        features: {
          usage: featureEnabled(env, "ENABLE_BILLING_USAGE"),
          keyRegistration: featureEnabled(env, "ENABLE_KEY_REGISTRATION"),
          custodial: featureEnabled(env, "ENABLE_CUSTODIAL"),
          ingress: featureEnabled(env, "ENABLE_INGRESS"),
          publicLedgerReads: featureEnabled(env, "ENABLE_PUBLIC_LEDGER_READS"),
          indexer: featureEnabled(env, "ENABLE_INDEXER"),
        },
      })
    }

    if (
      url.pathname === "/v1/usage" &&
      !featureEnabled(env, "ENABLE_BILLING_USAGE")
    ) {
      return featureUnavailable(request, "Usage billing")
    }
    if (
      url.pathname === "/v1/keys" &&
      request.method === "POST" &&
      !featureEnabled(env, "ENABLE_KEY_REGISTRATION")
    ) {
      return featureUnavailable(request, "API key registration")
    }
    if (
      url.pathname.startsWith("/v1/custodial/") &&
      !featureEnabled(env, "ENABLE_CUSTODIAL")
    ) {
      return featureUnavailable(request, "Custodial billing")
    }
    if (
      (url.pathname === "/v1/ingress" ||
        url.pathname.startsWith("/v1/ingress/") ||
        url.pathname === "/v1/admin/ingress") &&
      !featureEnabled(env, "ENABLE_INGRESS")
    ) {
      return featureUnavailable(request, "Key ingress")
    }
    if (
      /^\/v1\/(?:credits|tier|history)\//.test(url.pathname) &&
      !featureEnabled(env, "ENABLE_PUBLIC_LEDGER_READS")
    ) {
      return featureUnavailable(request, "Public ledger reads")
    }
    if (
      url.pathname === "/v1/admin/index" &&
      !featureEnabled(env, "ENABLE_INDEXER")
    ) {
      return featureUnavailable(request, "KV indexer")
    }

    let requestBody = {}
    if (["POST", "PUT", "DELETE"].includes(request.method)) {
      try {
        requestBody = await readJsonBody(request)
      } catch (err) {
        return json(
          request,
          {
            error:
              err instanceof RangeError
                ? "Request body too large"
                : "Invalid JSON body",
          },
          err instanceof RangeError ? 413 : 400
        )
      }
    }

    if (url.pathname === "/v1/usage" && request.method === "POST") {
      const body = requestBody
      const { apiKey, model, tokens } = body
      if (
        typeof apiKey !== "string" ||
        apiKey.length < 8 ||
        apiKey.length > 512
      ) {
        return json(request, { error: "Invalid apiKey" }, 401)
      }
      const keyHash = await hashKey(apiKey)
      const keyRowRaw = await env.CINA_BILLING_KV.get(`key:${keyHash}`)
      const keyRow = keyRowRaw ? JSON.parse(keyRowRaw) : null
      if (!keyRow) return json(request, { error: "Invalid API key" }, 401)

      const ledgerKey =
        keyRow.kind === "cust"
          ? `cust:${keyRow.custId}`
          : `ledger:${keyRow.address}`
      // lock: bare (lowercased) address for self keys — matches the
      // /v1/credits, /v1/tier and /v1/admin/badges confirm locks;
      // cust:<id> for custodial — matches the POST /v1/custodial/credit lock
      const lockKey =
        keyRow.kind === "cust" ? `cust:${keyRow.custId}` : keyRow.address

      const res = await withLedgerLock(lockKey, async () => {
        try {
          const ledgerRaw = await env.CINA_BILLING_KV.get(ledgerKey)
          const stored = ledgerRaw ? JSON.parse(ledgerRaw) : {}
          let snapshot
          if (keyRow.kind === "cust") {
            // DB-backed balance — the pool holds the real tokens (spec §6.1)
            snapshot = BigInt(stored.balanceWei ?? 0)
          } else {
            snapshot =
              (await refreshSnapshot(env, keyRow.address)) ??
              BigInt(stored.onchainSnapshot ?? 0)
          }
          const ledger = {
            onchainSnapshot: snapshot,
            committedUsage: BigInt(stored.committedUsage ?? 0),
            cumulativeSpend: BigInt(stored.cumulativeSpend ?? 0),
            mintedTierBadges: stored.mintedTierBadges ?? [],
          }
          // Runtime pricing (spec §7.2, grayscale): merge KV overrides onto the
          // default table once per request, inside the ledger lock so the price
          // a charge is metered at and the lock-held read are consistent. A
          // corrupted/invalid blob must never block charging — fall back to
          // defaults (fail-open on pricing, fail-closed on the ledger write).
          let pricing = DEFAULT_PRICING
          try {
            const pricingRaw = await env.CINA_BILLING_KV.get("pricing")
            if (pricingRaw)
              pricing = applyPricingOverrides(
                DEFAULT_PRICING,
                JSON.parse(pricingRaw)
              )
          } catch (err) {
            console.error(
              `[billing] pricing fallback to defaults: ${err?.message ?? err}`
            )
          }
          const res = await handleUsage({ model, tokens }, ledger, pricing)
          if (res.status === 200) {
            const updated = applyConsumption(
              ledger,
              BigInt(res.body.chargedWei)
            )
            const merged = {
              ...stored,
              committedUsage: updated.committedUsage.toString(),
              cumulativeSpend: updated.cumulativeSpend.toString(),
              tier: res.body.tier,
              pendingTierBadges: res.body.pendingBadges,
            }
            // COMMIT POINT — fail-closed: the ledger write lands first so a
            // committed charge is never lost to downstream bookkeeping.
            if (keyRow.kind === "cust") {
              // balanceWei (DB) unchanged by consumption; usage is committed
              await env.CINA_BILLING_KV.put(ledgerKey, JSON.stringify(merged))
            } else {
              await env.CINA_BILLING_KV.put(
                ledgerKey,
                JSON.stringify({
                  ...merged,
                  onchainSnapshot: snapshot.toString(),
                })
              )
            }
            // Consumption report (spec §7.2): best-effort after the commit —
            // a history failure must not fail-closed a committed charge.
            const histKey =
              keyRow.kind === "cust"
                ? `hist:cust:${keyRow.custId}`
                : `hist:${keyRow.address}`
            try {
              let hist = []
              try {
                const histRaw = await env.CINA_BILLING_KV.get(histKey)
                hist = histRaw ? JSON.parse(histRaw) : []
                if (!Array.isArray(hist)) hist = []
              } catch {
                console.error(
                  `[billing] resetting corrupted history ${histKey}`
                )
              }
              hist.push({
                ts: Date.now(),
                model: body.model ?? "demo",
                tokens: String(body.tokens ?? 0),
                chargedWei: res.body.chargedWei,
                tier: res.body.tier,
              })
              const trimmed = hist.slice(-100)
              await env.CINA_BILLING_KV.put(histKey, JSON.stringify(trimmed))
            } catch (err) {
              console.error(
                `[billing] history write-back failed for ${histKey}: ${
                  err?.message ?? err
                }`
              )
            }
            // Key ingress confirmation (spec §6.3): attribute this charge to
            // a pooled key; flip to minting once confirmed >= declared.
            // Best-effort under the ing lock (nested inside the user lock —
            // lock order user -> ing, so no deadlock with the confirm route).
            if (body.ingressId) {
              await withLedgerLock(`ing:${body.ingressId}`, async () => {
                try {
                  const ingKey = `ing:${body.ingressId}`
                  const ingRaw = await env.CINA_BILLING_KV.get(ingKey)
                  if (ingRaw) {
                    const rec = JSON.parse(ingRaw)
                    // spec §6.3: attribution is only valid for the pooled key
                    // that actually served this charge — skip mismatches.
                    if (rec.keyHash !== keyHash) {
                      console.error(
                        `[billing] ingress key mismatch for ${body.ingressId}`
                      )
                      return
                    }
                    if (rec.status === "pending") {
                      rec.confirmedMicro = (
                        BigInt(rec.confirmedMicro ?? 0) +
                        BigInt(res.body.chargedMicro)
                      ).toString()
                      if (
                        BigInt(rec.confirmedMicro) >= BigInt(rec.declaredMicro)
                      )
                        rec.status = "minting"
                      await env.CINA_BILLING_KV.put(ingKey, JSON.stringify(rec))
                    }
                  }
                } catch (err) {
                  console.error(
                    `[billing] ingress attribution failed for ${
                      body.ingressId
                    }: ${err?.message ?? err}`
                  )
                }
              })
            }
          }
          return res
        } catch (err) {
          return {
            status: 400,
            body: {
              error: err instanceof Error ? err.message : "Invalid request",
            },
          }
        }
      })
      return json(request, res.body, res.status)
    }

    const creditsMatch = /^\/v1\/credits\/(0x[a-fA-F0-9]{40})$/.exec(
      url.pathname
    )
    if (creditsMatch && request.method === "GET") {
      const address = creditsMatch[1].toLowerCase()
      const res = await withLedgerLock(address, async () => {
        try {
          const raw = await env.CINA_BILLING_KV.get(`ledger:${address}`)
          const ledger = raw ? JSON.parse(raw) : null
          const onchain =
            (await refreshSnapshot(env, address)) ??
            (ledger ? BigInt(ledger.onchainSnapshot ?? 0) : 0n)
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
          return {
            error: err instanceof Error ? err.message : "Invalid request",
          }
        }
      })
      return json(request, res)
    }

    const tierMatch = /^\/v1\/tier\/(0x[a-fA-F0-9]{40})$/.exec(url.pathname)
    if (tierMatch && request.method === "GET") {
      const address = tierMatch[1].toLowerCase()
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
          return {
            error: err instanceof Error ? err.message : "Invalid request",
          }
        }
      })
      return json(request, res)
    }

    // Consumption report (spec §7.2): last N metered charges for an address
    const historyMatch = /^\/v1\/history\/(0x[a-fA-F0-9]{40})$/.exec(
      url.pathname
    )
    if (historyMatch && request.method === "GET") {
      const address = historyMatch[1].toLowerCase()
      const rawLimit = Number(url.searchParams.get("limit") ?? 100)
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 100)
        : 100
      try {
        const raw = await env.CINA_BILLING_KV.get(`hist:${address}`)
        const entries = raw ? JSON.parse(raw) : []
        return json(request, { address, entries: entries.slice(-limit) })
      } catch {
        return json(request, { error: "History data corrupted" })
      }
    }

    // ── Custodial accounts (spec §6.1: hot wallet pool + DB bookkeeping) ──
    if (
      url.pathname === "/v1/custodial/accounts" &&
      request.method === "POST"
    ) {
      if (!checkRegRateLimit(request))
        return json(request, { error: "Too many requests" }, 429)
      const body = requestBody
      const { owner } = body
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner ?? ""))
        return json(request, { error: "Invalid owner" }, 400)
      const id = `cust_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
      await env.CINA_BILLING_KV.put(
        `cust:${id}`,
        JSON.stringify({
          owner: owner.toLowerCase(),
          balanceWei: "0",
          committedUsage: "0",
          cumulativeSpend: "0",
          pendingTierBadges: [],
          mintedTierBadges: [],
          createdAt: Date.now(),
        })
      )
      return json(request, { ok: true, id })
    }

    if (url.pathname === "/v1/custodial/credit" && request.method === "POST") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const body = requestBody
      const { id, amountWei } = body
      const key = `cust:${id ?? ""}`
      const res = await withLedgerLock(key, async () => {
        try {
          const raw = await env.CINA_BILLING_KV.get(key)
          const ledger = raw ? JSON.parse(raw) : null
          if (!ledger)
            return { status: 404, body: { error: "Account not found" } }
          const add = BigInt(amountWei ?? 0)
          if (add <= 0n)
            return { status: 400, body: { error: "amountWei must be > 0" } }
          ledger.balanceWei = (BigInt(ledger.balanceWei ?? 0) + add).toString()
          await env.CINA_BILLING_KV.put(key, JSON.stringify(ledger))
          return {
            status: 200,
            body: { ok: true, balanceWei: ledger.balanceWei },
          }
        } catch (err) {
          return {
            status: 400,
            body: {
              error: err instanceof Error ? err.message : "Invalid request",
            },
          }
        }
      })
      return json(request, res.body, res.status)
    }

    if (url.pathname === "/v1/custodial/debit" && request.method === "POST") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const body = requestBody
      const { id, amountWei } = body
      const key = `cust:${id ?? ""}`
      const res = await withLedgerLock(key, async () => {
        try {
          const raw = await env.CINA_BILLING_KV.get(key)
          const ledger = raw ? JSON.parse(raw) : null
          if (!ledger)
            return { status: 404, body: { error: "Account not found" } }
          const sub = BigInt(amountWei ?? 0)
          if (sub <= 0n)
            return { status: 400, body: { error: "amountWei must be > 0" } }
          const current = BigInt(ledger.balanceWei ?? 0)
          if (current < sub)
            return { status: 400, body: { error: "Insufficient balance" } }
          ledger.balanceWei = (current - sub).toString()
          await env.CINA_BILLING_KV.put(key, JSON.stringify(ledger))
          return {
            status: 200,
            body: { ok: true, balanceWei: ledger.balanceWei },
          }
        } catch (err) {
          return {
            status: 400,
            body: {
              error: err instanceof Error ? err.message : "Invalid request",
            },
          }
        }
      })
      return json(request, res.body, res.status)
    }

    const custodialMatch = /^\/v1\/custodial\/(cust_[a-f0-9]{16})$/.exec(
      url.pathname
    )
    if (custodialMatch && request.method === "GET") {
      const id = custodialMatch[1]
      const raw = await env.CINA_BILLING_KV.get(`cust:${id}`)
      if (!raw) return json(request, { error: "Account not found" }, 404)
      let ledger
      try {
        ledger = JSON.parse(raw)
      } catch {
        // one malformed row must not 500 the read path (mirrors credits/tier)
        return json(request, { error: "Account data corrupted" })
      }
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

    // Key ingress submit (spec §6.3): register a key + declared amount
    if (url.pathname === "/v1/ingress" && request.method === "POST") {
      if (!checkRegRateLimit(request))
        return json(request, { error: "Too many requests" }, 429)
      const body = requestBody
      const { apiKey, model, declaredMicro, owner } = body
      if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20)
        return json(request, { error: "Invalid apiKey" }, 400)
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner ?? ""))
        return json(request, { error: "Invalid owner" }, 400)
      if (
        !model ||
        !["demo", "gpt-4o-mini", "deepseek-v3", "hunyuan"].includes(model)
      )
        return json(request, { error: "Invalid model" }, 400)
      let declared
      try {
        declared = validateDeclaredMicro(declaredMicro)
      } catch (err) {
        return json(
          request,
          {
            error: err instanceof Error ? err.message : "Invalid declaredMicro",
          },
          400
        )
      }
      const keyHash = await hashKey(apiKey)
      // reject duplicate submissions of the same key
      const existingRaw = await env.CINA_BILLING_KV.get(`keyhash:${keyHash}`)
      if (existingRaw)
        return json(request, { error: "Key already registered" }, 409)
      // optional upstream validation probe (testnet: unset -> skip)
      if (env.INGRESS_VALIDATE_URL) {
        try {
          const probe = await fetch(env.INGRESS_VALIDATE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model }),
            signal: AbortSignal.timeout(10_000),
          })
          if (!probe.ok)
            return json(request, { error: "Key validation failed" }, 400)
        } catch {
          return json(request, { error: "Key validation failed" }, 400)
        }
      }
      let secretHex
      try {
        secretHex = await secretValue(env.INGRESS_ENC_KEY)
      } catch {
        return json(
          request,
          { error: "Service configuration unavailable" },
          503
        )
      }
      if (!/^[0-9a-f]{64}$/i.test(secretHex) || /^(.)\1+$/.test(secretHex)) {
        return json(
          request,
          { error: "Service configuration unavailable" },
          503
        )
      }
      const encrypted = await encryptKey(secretHex, apiKey)
      const id = `ing_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
      const rec = ingressRecord({
        owner: owner.toLowerCase(),
        model,
        declaredMicro: declared,
        keyHash,
      })
      await env.CINA_BILLING_KV.put(
        `ing:${id}`,
        JSON.stringify({ ...rec, encrypted })
      )
      await env.CINA_BILLING_KV.put(`keyhash:${keyHash}`, id)
      return json(request, {
        ok: true,
        id,
        status: rec.status,
        declaredMicro: rec.declaredMicro,
        model: rec.model,
      })
    }

    // Public: list own ingress records (spec §6.3: user can view pending status).
    // Never exposes key material — id/model/micro amounts/status/createdAt only.
    if (url.pathname === "/v1/ingress" && request.method === "GET") {
      if (!checkReadRateLimit(request))
        return json(request, { error: "Too many requests" }, 429)
      const owner = (url.searchParams.get("owner") ?? "").toLowerCase()
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner))
        return json(request, { error: "Invalid owner" }, 400)
      const keys = await listAllKeys(env.CINA_BILLING_KV, "ing:")
      const records = []
      for (const { name } of keys) {
        const raw = await env.CINA_BILLING_KV.get(name)
        if (!raw) continue
        let rec
        try {
          rec = JSON.parse(raw)
        } catch {
          continue
        }
        if (rec.owner === owner) {
          records.push({
            id: name.slice("ing:".length),
            model: rec.model,
            declaredMicro: rec.declaredMicro,
            confirmedMicro: rec.confirmedMicro,
            status: rec.status,
            createdAt: rec.createdAt,
          })
        }
      }
      return json(request, { records })
    }

    // Admin: confirm an ingress mint (moves minting -> minted, records txHash)
    const ingConfirmMatch = url.pathname.match(
      /^\/v1\/ingress\/([a-zA-Z0-9_]+)\/confirm$/
    )
    if (ingConfirmMatch && request.method === "POST") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const [, id] = ingConfirmMatch
      const body = requestBody
      const key = `ing:${id}`
      const res = await withLedgerLock(`ing:${id}`, async () => {
        const raw = await env.CINA_BILLING_KV.get(key)
        if (!raw)
          return { status: 404, body: { error: "Ingress record not found" } }
        let rec
        try {
          rec = JSON.parse(raw)
        } catch {
          return { status: 400, body: { error: "Ingress record corrupted" } }
        }
        if (!ingressStatusTransitions(rec.status, "minted")) {
          // Idempotency for retries: the same mint already confirmed with the
          // same txHash must not error (admin scripts retry after timeouts) —
          // and must not double-mint. A *different* txHash on an already-minted
          // record is a conflicting double-mint attempt and stays rejected.
          const txHash = body.txHash ?? null
          if (rec.status === "minted" && rec.txHash === txHash) {
            return {
              status: 200,
              body: { ok: true, id, status: rec.status, alreadyMinted: true },
            }
          }
          return {
            status: 400,
            body: { error: `Invalid transition from ${rec.status}` },
          }
        }
        rec.status = "minted"
        rec.txHash = body.txHash ?? null
        await env.CINA_BILLING_KV.put(key, JSON.stringify(rec))
        return { status: 200, body: { ok: true, id, status: rec.status } }
      })
      return json(request, res.body, res.status)
    }

    // Admin: list ingress records (status filter optional)
    if (url.pathname === "/v1/admin/ingress" && request.method === "GET") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const status = url.searchParams.get("status") ?? "minting"
      const keys = await listAllKeys(env.CINA_BILLING_KV, "ing:")
      const records = []
      for (const { name } of keys) {
        const raw = await env.CINA_BILLING_KV.get(name)
        if (!raw) continue
        let rec
        try {
          rec = JSON.parse(raw)
        } catch {
          continue
        }
        if (rec.status === status) {
          records.push({
            id: name.slice("ing:".length),
            owner: rec.owner,
            model: rec.model,
            declaredMicro: rec.declaredMicro,
            confirmedMicro: rec.confirmedMicro,
            status: rec.status,
            createdAt: rec.createdAt,
          })
        }
      }
      return json(request, { records })
    }

    // POST /v1/keys — register an API key bound to an address (self-managed)
    // or to a custodial account (spec §6.1). Self-managed keys require a
    // SIWE-signed binding message proving address ownership (EOA recovery or
    // EIP-1271 eth_call); counterfactual smart accounts must deploy first.
    if (url.pathname === "/v1/keys" && request.method === "POST") {
      if (!checkRegRateLimit(request))
        return json(request, { error: "Too many requests" }, 429)
      const body = requestBody
      const { apiKey, address, custId, message, signature } = body
      if (
        !apiKey ||
        typeof apiKey !== "string" ||
        apiKey.length < 20 ||
        apiKey.length > 512
      )
        return json(request, { error: "Invalid apiKey" }, 400)
      const hash = await hashKey(apiKey)
      if (address) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address))
          return json(request, { error: "Invalid address" }, 400)
        // -- Address-ownership proof (spec §6.1) ----------------------------
        const parsed = parseBindingMessage(message)
        if (
          !parsed ||
          parsed.address.toLowerCase() !== address.toLowerCase() ||
          parsed.apiKeyHash !== hash
        ) {
          return json(
            request,
            {
              error:
                "binding message must bind this API key hash to this address",
            },
            400
          )
        }
        if (
          parsed.uri !== BINDING_URI ||
          parsed.chainId !== CHAIN_ID.toString()
        ) {
          return json(
            request,
            {
              error:
                "message must target billing-api.cinachain.com on Base Sepolia",
            },
            400
          )
        }
        // Freshness: issuedAt within the last 5 minutes (and not from the
        // future by more than a minute of clock skew).
        const issued = Date.parse(parsed.issuedAt)
        const skew = Date.now() - issued
        if (Number.isNaN(issued) || skew > 5 * 60 * 1000 || skew < -60 * 1000) {
          return json(
            request,
            { error: "message expired; sign a fresh one" },
            400
          )
        }
        // Nonce replay protection: one use per nonce, kept for 1 hour.
        const nonceKey = `nonce:${await hashKey(
          `${parsed.nonce}${address.toLowerCase()}${parsed.apiKeyHash}`
        )}`
        if (await env.CINA_BILLING_KV.get(nonceKey)) {
          return json(
            request,
            { error: "Nonce already used; sign a fresh message" },
            400
          )
        }
        const proof = await verifyOwnership(env, {
          address,
          message,
          signature,
        })
        if (!proof.ok) return json(request, { error: proof.error }, 403)
        await env.CINA_BILLING_KV.put(nonceKey, "1", { expirationTtl: 3600 })
        await env.CINA_BILLING_KV.put(
          `key:${hash}`,
          JSON.stringify({ kind: "self", address: address.toLowerCase() })
        )
        return json(request, { ok: true, address: address.toLowerCase() })
      }
      if (custId) {
        return json(
          request,
          {
            error:
              "Custodial API key binding is disabled until account ownership authentication is implemented",
          },
          403
        )
      }
      return json(request, { error: "address or custId required" }, 400)
    }

    // Possession of the raw API key authorizes revoking that key. This keeps
    // server state aligned with the UI instead of merely deleting local data.
    if (url.pathname === "/v1/keys" && request.method === "DELETE") {
      const { apiKey } = requestBody
      if (
        typeof apiKey !== "string" ||
        apiKey.length < 20 ||
        apiKey.length > 512
      ) {
        return json(request, { error: "Invalid apiKey" }, 400)
      }
      const hash = await hashKey(apiKey)
      const key = `key:${hash}`
      if (!(await env.CINA_BILLING_KV.get(key))) {
        return json(request, { error: "API key not found" }, 404)
      }
      if (typeof env.CINA_BILLING_KV.delete !== "function") {
        return json(request, { error: "Key revocation unavailable" }, 503)
      }
      await env.CINA_BILLING_KV.delete(key)
      return json(request, { ok: true })
    }

    // Admin: list addresses with pending tier badges (spec §5 minting flow)
    // Scans both self-hosted ledgers (ledger:<address>) and custodial rows
    // (cust:<id>) so badges accrued on custodial accounts are visible too.
    if (
      url.pathname === "/v1/admin/pending-badges" &&
      request.method === "GET"
    ) {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const pending = []
      for (const prefix of ["ledger:", "cust:"]) {
        const keys = await listAllKeys(env.CINA_BILLING_KV, prefix)
        for (const { name } of keys) {
          const raw = await env.CINA_BILLING_KV.get(name)
          if (!raw) continue
          let ledger
          try {
            ledger = JSON.parse(raw)
          } catch (err) {
            // One malformed row (e.g. manual/console edit) must not abort the
            // admin listing — skip it and carry on (mirrors indexer-run.js).
            console.error(
              `[admin] skipping malformed ${name}:`,
              err?.message ?? err
            )
            continue
          }
          const badges = (ledger.pendingTierBadges ?? []).filter(
            (t) => tierBadgeId(t) !== null
          )
          if (!badges.length) continue
          if (prefix === "cust:") {
            pending.push({
              address: ledger.owner,
              custId: name.slice("cust:".length),
              badges,
              cumulativeSpend: ledger.cumulativeSpend ?? "0",
            })
          } else {
            pending.push({
              address: name.slice("ledger:".length),
              badges,
              cumulativeSpend: ledger.cumulativeSpend ?? "0",
            })
          }
        }
      }
      return json(request, { pending })
    }

    // Admin: confirm a badge was minted on-chain (moves pending -> minted).
    // A custodial account may be confirmed by its owner address + custId in
    // the body; the write then lands on cust:<custId> (never a phantom
    // ledger:<address> row) and the lock uses the custId.
    const confirmMatch = url.pathname.match(
      /^\/v1\/admin\/badges\/(0x[a-fA-F0-9]{40})\/([a-z]+)\/confirm$/
    )
    if (confirmMatch && request.method === "POST") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const [, address, tier] = confirmMatch
      if (tierBadgeId(tier) === null)
        return json(request, { error: "Invalid tier" }, 400)
      const body = requestBody
      const targetKey = body.custId
        ? `cust:${body.custId}`
        : `ledger:${address.toLowerCase()}`
      const lockKey = body.custId
        ? `cust:${body.custId}`
        : address.toLowerCase()
      const res = await withLedgerLock(lockKey, async () => {
        const raw = await env.CINA_BILLING_KV.get(targetKey)
        let ledger
        try {
          ledger = raw ? JSON.parse(raw) : {}
        } catch {
          return { error: "Ledger data corrupted" }
        }
        const minted = [...new Set([...(ledger.mintedTierBadges ?? []), tier])]
        await env.CINA_BILLING_KV.put(
          targetKey,
          JSON.stringify({
            ...ledger,
            pendingTierBadges: (ledger.pendingTierBadges ?? []).filter(
              (t) => t !== tier
            ),
            mintedTierBadges: minted,
            badgeTxHashes: {
              ...(ledger.badgeTxHashes ?? {}),
              [tier]: body.txHash ?? null,
            },
          })
        )
        return { ok: true, address, tier, custId: body.custId ?? null }
      })
      return json(request, res)
    }

    // Admin: view pricing (default + overrides)
    if (url.pathname === "/v1/admin/pricing" && request.method === "GET") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const raw = await env.CINA_BILLING_KV.get("pricing")
      let overrides = {}
      try {
        overrides = raw ? JSON.parse(raw) : {}
      } catch {
        return json(request, { error: "Pricing data corrupted" })
      }
      return json(request, { default: DEFAULT_PRICING, overrides })
    }

    // Admin: update pricing overrides (spec §7.2 — grayscale, no redeploy).
    // Validates against the default table BEFORE persisting, so a bad override
    // never lands in KV and never breaks the usage hot path.
    if (url.pathname === "/v1/admin/pricing" && request.method === "PUT") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const body = requestBody
      try {
        const merged = applyPricingOverrides(
          DEFAULT_PRICING,
          body.overrides ?? null
        )
        await env.CINA_BILLING_KV.put(
          "pricing",
          JSON.stringify(body.overrides ?? {})
        )
        return json(request, { ok: true, merged })
      } catch (err) {
        return json(
          request,
          { error: err instanceof Error ? err.message : "Invalid pricing" },
          400
        )
      }
    }

    // Manual indexer trigger (admin key; also used by tests/E2E)
    if (url.pathname === "/v1/admin/index" && request.method === "POST") {
      const authError = await requireAdmin(request, env)
      if (authError) return authError
      const res = await runIndexer(env).catch((err) => ({
        error: err instanceof Error ? err.message : "indexer failed",
      }))
      return json(request, res)
    }

    return json(request, { error: "Not found" }, 404)
  },
}
