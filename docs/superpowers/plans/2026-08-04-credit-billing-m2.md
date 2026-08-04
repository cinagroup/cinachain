# M2 计费系统：事件索引对账 + 会员等级徽章 + 托管账户 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 spec `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` §8 的 M2 里程碑：事件索引器接线（转账/转出实时反映额度）、会员等级（累计消耗 → 等级 → 徽章发放）、托管账户（热钱包池 + KV 记账）。

**Architecture:** 三层联动 — (1) Worker 新增 `scheduled()` cron 处理器轮询 CinaCredit `Transfer` 事件，用纯函数 `mergeTransfers` 增量更新每个有 ledger 的地址的 `onchainSnapshot`（消除 30s RPC 快照窗口）；(2) 计量核心扩展 Whale 等级与等级→徽章映射，消费时检测等级提升写入 `pendingTierBadges`，owner 铸造后经 admin 端点确认；(3) 托管账户以 `cust:<id>` KV 记录承载（DB 权威余额，池钱包持有真实资产），API Key 可绑定托管账户。

**Tech Stack:** Cloudflare Workers（scheduled cron + KV）、原始 `eth_getLogs`（worker 无 viem）、viem 脚本（badge 设置/铸造，owner key）、vitest TDD、Next.js 前端扩展。

---

## 计划偏差记录（相对 spec）

| spec 假设 | 实际 | 处理 |
|---|---|---|
| 等级徽章 ID 10-14（§3.2） | CinaBadge `nextCustomBadgeId = 100`，自定义徽章从 100 起 | 等级徽章 ID 用 **100-104**，Task 5 中同步修正 spec 文档 |
| 索引器轮询 30s（§4.3） | Cloudflare cron 最小粒度 1 分钟 | 每 1 分钟轮询（wrangler `[triggers]`），并保留请求路径 RPC 兜底 |
| 托管账户"热钱包池 + DB"（§6.1） | 池私钥不进 worker（安全）；提现 = admin 脚本链上转账 + worker 确认 | Task 7/8 按此落地，池 key 本地保存 |

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `workers/billing/src/lib/indexer-run.js` | eth_getLogs 轮询、Transfer 解析、逐地址快照增量更新、KV 游标 | 新建 |
| `workers/billing/src/lib/indexer-run.test.js` | 解析/游标/更新逻辑单元测试 | 新建 |
| `workers/billing/src/lib/billing-core.js` | +Whale 等级、TIER_BADGE_IDS、tiersEarned、tierProgress | 修改 |
| `workers/billing/src/lib/billing-core.test.js` | +新函数测试 | 修改 |
| `workers/billing/src/index.js` | scheduled 处理器、/v1/tier、/v1/admin/pending-badges、/v1/admin/badges 确认、/v1/custodial/*、usage 支持 cust key | 修改 |
| `workers/billing/src/index.test.js` | +新端点测试 | 修改 |
| `workers/billing/wrangler.toml` | +`[triggers]` cron、ADMIN_KEY var | 修改 |
| `scripts/setup-tier-badges.mjs` | createBadgeType 100-104（owner） | 新建 |
| `scripts/mint-tier-badges.mjs` | 拉取 pending → CinaBadge.mint → 确认 | 新建 |
| `scripts/custodial-pool.mjs` | 生成池钱包、mintTo 注资、提现转账（owner） | 新建 |
| `lib/hooks/use-tier-progress.ts` | GET /v1/tier/:address 前端 hook | 新建 |
| `app/dashboard/page.tsx` | +等级进度卡片 | 修改 |
| `app/admin/billing/page.tsx` | +等级徽章铸造区 + 托管账户管理区 | 修改 |
| `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` | §3.2 徽章 ID 修正为 100-104 | 修改 |

---

## Task 1: 索引器核心 — Transfer 解析 + 快照增量更新（纯逻辑）

**Files:**
- Create: `workers/billing/src/lib/indexer-run.js`
- Test: `workers/billing/src/lib/indexer-run.test.js`

- [ ] **Step 1: 写失败测试**

```js
// workers/billing/src/lib/indexer-run.test.js
import { describe, it, expect } from "vitest"
import { parseTransferLogs, nextCursorRange, selectAddressLogs } from "./indexer-run.js"

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f"

describe("parseTransferLogs", () => {
  it("decodes from/to/value from raw eth_getLogs payload", () => {
    const logs = [
      {
        topics: [TRANSFER_TOPIC,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
        blockNumber: "0x10",
      },
      {
        topics: [TRANSFER_TOPIC,
          "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
        data: "0x0000000000000000000000000000000000000000000000000000000000000064",
        blockNumber: "0x11",
      },
    ]
    const parsed = parseTransferLogs(logs)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({
      from: "0x0000000000000000000000000000000000000000",
      to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      value: 1_000_000_000_000_000_000n,
    })
    expect(parsed[1].from).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(parsed[1].to).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    expect(parsed[1].value).toBe(100n)
  })
})

describe("nextCursorRange", () => {
  it("caps range at MAX_BLOCKS_PER_CALL", () => {
    expect(nextCursorRange(100n, 100_000n, 5000n)).toEqual({ from: 101n, to: 5100n })
  })
  it("clamps to latest", () => {
    expect(nextCursorRange(100n, 4000n, 5000n)).toEqual({ from: 101n, to: 4000n })
  })
  it("returns null when caught up", () => {
    expect(nextCursorRange(4000n, 4000n, 5000n)).toBeNull()
  })
})

describe("selectAddressLogs", () => {
  it("filters logs touching a given address (either side)", () => {
    const logs = [
      { from: "0x0000000000000000000000000000000000000000", to: "0xaaa", value: 1n },
      { from: "0xaaa", to: "0xbbb", value: 2n },
      { from: "0xccc", to: "0xddd", value: 3n },
    ]
    expect(selectAddressLogs(logs, "0xaaa")).toHaveLength(2)
    expect(selectAddressLogs(logs, "0xddd")).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/lib/indexer-run.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 indexer-run.js（纯函数部分）**

```js
// workers/billing/src/lib/indexer-run.js
// Scheduled event indexer: polls CinaCredit Transfer events and applies
// incremental deltas to per-address ledger snapshots (spec §4.3).
import { mergeTransfers } from "./indexer.js"

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f"
export const MAX_BLOCKS_PER_CALL = 5000n

function hexToAddress(topic) {
  return `0x${topic.slice(26)}`.toLowerCase()
}

/** Decode raw eth_getLogs Transfer payloads into {from,to,value} */
export function parseTransferLogs(logs) {
  return logs.map((l) => ({
    from: hexToAddress(l.topics[1]),
    to: hexToAddress(l.topics[2]),
    value: BigInt(l.data),
  }))
}

/** Next [from,to] inclusive block range, or null when caught up */
export function nextCursorRange(cursor, latest, chunk = MAX_BLOCKS_PER_CALL) {
  if (cursor >= latest) return null
  const from = cursor + 1n
  const to = from + chunk - 1n > latest ? latest : from + chunk - 1n
  return { from, to }
}

/** Logs touching an address on either side (from OR to) */
export function selectAddressLogs(logs, address) {
  return logs.filter((l) => l.from === address || l.to === address)
}

/**
 * Apply a batch of transfer logs to one address's current snapshot using
 * the immutable mergeTransfers semantics (mint adds, out subtracts floor 0).
 */
export function applyLogsToSnapshot(logs, address, current) {
  const touched = selectAddressLogs(logs, address)
  if (!touched.length) return current
  return mergeTransfers(touched, { [address]: current })[address]
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/src/lib/indexer-run.test.js`
Expected: PASS (6 assertions)

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/lib/indexer-run.js workers/billing/src/lib/indexer-run.test.js
git commit -m "feat(billing): indexer core — transfer parsing, cursor ranges, snapshot deltas"
```

---

## Task 2: 索引器接线 — scheduled cron + KV 游标 + 快照回写

**Files:**
- Modify: `workers/billing/src/lib/indexer-run.js`（+rpcCall/fetchTransferLogs/runIndexer/listAllKeys）
- Modify: `workers/billing/src/index.js`（+scheduled handler、+POST /v1/admin/index 手动触发）
- Modify: `workers/billing/wrangler.toml`（+[triggers] crons）
- Test: `workers/billing/src/index.test.js`（+scheduled 导出测试）

- [ ] **Step 1: 写失败测试（indexer-run.test.js 追加）**

```js
// 追加到 workers/billing/src/lib/indexer-run.test.js
import { runIndexer, listAllKeys } from "./indexer-run.js"

function mockKv(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null },
    async put(k, v) { store.set(k, v) },
    async list({ prefix } = {}) {
      return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }
    },
  }
}

describe("runIndexer", () => {
  it("updates ledger snapshots from transfer logs and advances cursor", async () => {
    const kv = mockKv({
      // pre-seeded cursor forces a scan window (cold start would seed at latest)
      "idx:lastBlock": "0",
      "ledger:0xaaa": JSON.stringify({ onchainSnapshot: "1000000000000000000", committedUsage: "0", cumulativeSpend: "0" }),
    })
    const fakeEnv = {
      CINA_BILLING_KV: kv,
      BASE_SEPOLIA_RPC: "https://fake",
      CINA_CREDIT_ADDRESS: "0xcredit",
    }
    // latest = 0x10, one transfer-out of 200 wei from 0xaaa
    const calls = []
    global.fetch = async (url, opts) => {
      const body = JSON.parse(opts.body)
      calls.push(body.method)
      if (body.method === "eth_blockNumber") {
        return { json: async () => ({ result: "0x10" }) }
      }
      if (body.method === "eth_getLogs") {
        return { json: async () => ({ result: [{
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3f",
            "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ],
          data: "0x00000000000000000000000000000000000000000000000000000000000000c8",
          blockNumber: "0x10",
        }] }) }
      }
      throw new Error(`unexpected method ${body.method}`)
    }
    const res = await runIndexer(fakeEnv)
    expect(calls).toContain("eth_blockNumber")
    expect(res.updated).toBe(1)
    const stored = JSON.parse(kv.store.get("ledger:0xaaa"))
    expect(stored.onchainSnapshot).toBe("999999999999999800") // 1e18 - 200
    expect(kv.store.get("idx:lastBlock")).toBe("16")
  })

  it("cold start: seeds cursor at latest without backfill", async () => {
    const kv = mockKv({})
    const fakeEnv = { CINA_BILLING_KV: kv, BASE_SEPOLIA_RPC: "https://fake", CINA_CREDIT_ADDRESS: "0xcredit" }
    global.fetch = async () => ({ json: async () => ({ result: "0x1234" }) })
    const res = await runIndexer(fakeEnv)
    expect(res.updated).toBe(0)
    expect(kv.store.get("idx:lastBlock")).toBe("4660")
  })
})

describe("listAllKeys", () => {
  it("paginates KV list cursor", async () => {
    const keys = Array.from({ length: 1200 }, (_, i) => ({ name: `ledger:0x${i.toString(16).padStart(40, "0")}` }))
    const kv = {
      async list({ prefix, cursor } = {}) {
        const start = cursor ? Number(cursor) : 0
        const slice = keys.slice(start, start + 1000)
        return { keys: slice, cursor: start + 1000 < keys.length ? String(start + 1000) : undefined }
      },
    }
    const all = await listAllKeys(kv, "ledger:")
    expect(all).toHaveLength(1200)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/lib/indexer-run.test.js`
Expected: FAIL — `runIndexer` is not a function

- [ ] **Step 3: 实现 I/O 部分（indexer-run.js 追加）**

```js
// 追加到 workers/billing/src/lib/indexer-run.js
async function rpcCall(rpc, method, params = []) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  })
  const j = await res.json()
  if (j.error) throw new Error(j.error.message ?? `${method} failed`)
  return j.result
}

async function fetchTransferLogs(env, fromBlock, toBlock) {
  const rpc = env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  const result = await rpcCall(rpc, "eth_getLogs", [
    {
      address: env.CINA_CREDIT_ADDRESS,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      topics: [TRANSFER_TOPIC],
    },
  ])
  return parseTransferLogs(result ?? [])
}

/** Paginate a KV list() across the 1000-key page limit */
export async function listAllKeys(kv, prefix) {
  const out = []
  let cursor
  do {
    const page = await kv.list({ prefix, ...(cursor ? { cursor } : {}) })
    out.push(...page.keys)
    cursor = page.cursor
  } while (cursor)
  return out
}

/**
 * One indexer pass: advance cursor, pull Transfer logs, apply deltas to
 * every ledger row we track. Returns {scanned, updated, cursor}.
 * Cold start (no cursor yet): seed cursor at latest, no backfill — existing
 * balances are covered by the request-path RPC snapshot (refreshSnapshot).
 */
export async function runIndexer(env) {
  const kv = env.CINA_BILLING_KV
  const latest = BigInt(await rpcCall(env.BASE_SEPOLIA_RPC || "https://sepolia.base.org", "eth_blockNumber"))
  const cursorRaw = await kv.get("idx:lastBlock")
  const cursor = cursorRaw ? BigInt(cursorRaw) : latest
  // cold start: persist the cursor so the next run scans forward
  if (!cursorRaw) await kv.put("idx:lastBlock", cursor.toString())
  const range = nextCursorRange(cursor, latest)
  if (!range) return { scanned: "0", updated: 0, cursor: cursor.toString() }

  const logs = await fetchTransferLogs(env, range.from, range.to)
  const ledgerKeys = await listAllKeys(kv, "ledger:")
  let updated = 0
  for (const { name } of ledgerKeys) {
    const addr = name.slice("ledger:".length)
    const raw = await kv.get(name)
    if (!raw) continue
    const ledger = JSON.parse(raw)
    const current = BigInt(ledger.onchainSnapshot ?? 0)
    const next = applyLogsToSnapshot(logs, addr, current)
    if (next !== current) {
      ledger.onchainSnapshot = next.toString()
      await kv.put(name, JSON.stringify(ledger))
      updated++
    }
  }
  await kv.put("idx:lastBlock", range.to.toString())
  return { scanned: (range.to - range.from + 1n).toString(), updated, cursor: range.to.toString() }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/src/lib/indexer-run.test.js`
Expected: PASS（含新增 3 组）

- [ ] **Step 5: worker 接线 — index.js**

在 `import` 区追加：

```js
import { runIndexer } from "./lib/indexer-run.js"
```

在 `export default {` 对象内、`fetch` 前追加 scheduled 处理器：

```js
export default {
  /** Spec §4.3: cron-driven indexer keeps ledger snapshots in sync */
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runIndexer(env).catch((err) => console.error("[indexer] failed:", err?.message ?? err))
    )
  },

  async fetch(request, env) {
```

在 `/v1/keys` 路由块之后、`return json(request, { error: "Not found" }, 404)` 之前追加手动触发端点（带 admin key 保护）：

```js
    // Manual indexer trigger (admin key; also used by tests/E2E)
    if (url.pathname === "/v1/admin/index" && request.method === "POST") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const res = await runIndexer(env).catch((err) => ({ error: err instanceof Error ? err.message : "indexer failed" }))
      return json(request, res)
    }
```

- [ ] **Step 6: 更新 CORS 允许 admin header（index.js corsHeaders）**

```js
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Key"
```

- [ ] **Step 7: wrangler.toml 追加 cron 与 admin key**

```toml
[vars]
API_VERSION = "v1"
CINA_CREDIT_ADDRESS = "0x78f5aebc75b7d197b10622cccabe8429617836d7"
BASE_SEPOLIA_RPC = "https://sepolia.base.org"
# Testnet admin key — mainnet: replace with secret + SIWE (M2 known limit)
ADMIN_KEY = "cinachain-admin-dev-2026"

[triggers]
crons = ["* * * * *"]
```

- [ ] **Step 8: index.test.js 追加 scheduled 导出测试**

```js
// 追加到 workers/billing/src/index.test.js
import billingWorker from "./index.js"

describe("billing worker", () => {
  it("exposes a scheduled handler for the indexer cron", () => {
    expect(typeof billingWorker.scheduled).toBe("function")
  })
})
```

Run: `npx vitest run workers/billing/`
Expected: PASS 全部

- [ ] **Step 9: Commit**

```bash
git add workers/billing/
git commit -m "feat(billing): wire scheduled indexer cron with KV cursor (M2 §4.3)"
```

---

## Task 3: 等级引擎扩展 — Whale + 徽章映射 + 进度

**Files:**
- Modify: `workers/billing/src/lib/billing-core.js`
- Test: `workers/billing/src/lib/billing-core.test.js`

- [ ] **Step 1: 写失败测试（billing-core.test.js 追加）**

```js
// 追加到 workers/billing/src/lib/billing-core.test.js
import { getTier, tiersEarned, tierProgress, TIER_BADGE_IDS, estimateCost } from "./billing-core.js"

describe("M2 tier engine", () => {
  it("whale threshold at 100M credit", () => {
    const whale = 100_000_000n * 10n ** 18n
    expect(getTier(whale - 1n)).toBe("diamond")
    expect(getTier(whale)).toBe("whale")
  })
  it("tiersEarned lists every threshold crossed, ascending", () => {
    const spend = 120_000n * 10n ** 18n // 12 万 credit: bronze + silver
    expect(tiersEarned(spend)).toEqual(["bronze", "silver"])
    expect(tiersEarned(0n)).toEqual([])
  })
  it("tierProgress reports next tier and bps progress", () => {
    // bronze floor 10k, silver next 100k; 55k -> (55-10)/(100-10) = 50%
    const spend = 55_000n * 10n ** 18n
    const p = tierProgress(spend)
    expect(p.tier).toBe("bronze")
    expect(p.nextTier).toBe("silver")
    expect(p.progressBps).toBe(5000)
    expect(p.nextMin).toBe((100_000n * 10n ** 18n).toString())
  })
  it("tierProgress caps at whale (no next tier)", () => {
    const p = tierProgress(1_000_000_000n * 10n ** 18n)
    expect(p.tier).toBe("whale")
    expect(p.nextTier).toBeNull()
    expect(p.progressBps).toBe(10000)
  })
  it("badge id map covers bronze..whale", () => {
    expect(TIER_BADGE_IDS).toEqual({ bronze: 100n, silver: 101n, gold: 102n, diamond: 103n, whale: 104n })
  })
  it("whale keeps full pricing (custom contract outside scope)", () => {
    const whaleLedger = { cumulativeSpend: 100_000_000n * 10n ** 18n }
    const tier = getTier(whaleLedger.cumulativeSpend)
    const cost = estimateCost("demo", 1000n, tier)
    expect(cost).toBe(2_000_000n) // 2000 micro × 1000 tokens, no discount
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/lib/billing-core.test.js`
Expected: FAIL — whale 等级不存在 / tiersEarned 未定义

- [ ] **Step 3: 实现（billing-core.js）**

将 `TIER_DISCOUNT_BPS` 替换为：

```js
export const TIER_DISCOUNT_BPS = {
  free: 0n,
  bronze: 500n,   // 95%
  silver: 1000n,  // 90%
  gold: 1500n,    // 85%
  diamond: 2000n, // 80%
  whale: 0n,      // custom contract pricing — no automatic discount (spec §5)
}
```

将 `TIER_THRESHOLDS` 替换为（whale 加入，spec §5 1 亿 credit）：

```js
export const TIER_THRESHOLDS = [
  { tier: "whale", min: 100_000_000n * 10n ** 18n }, // 1 亿 credit
  { tier: "diamond", min: 10_000_000n * 10n ** 18n }, // 1000 万 credit
  { tier: "gold", min: 1_000_000n * 10n ** 18n },     // 100 万 credit
  { tier: "silver", min: 100_000n * 10n ** 18n },     // 10 万 credit
  { tier: "bronze", min: 10_000n * 10n ** 18n },      // 1 万 credit
  { tier: "free", min: 0n },
]

// Tier -> CinaBadge token ID. CinaBadge assigns custom badge types from 100
// (nextCustomBadgeId = 100) — spec §3.2 assumed 10-14, corrected to 100-104.
export const TIER_BADGE_IDS = {
  bronze: 100n,
  silver: 101n,
  gold: 102n,
  diamond: 103n,
  whale: 104n,
}

/** Badge ID for a tier, or null when the tier has no badge (free) */
export function tierBadgeId(tier) {
  return TIER_BADGE_IDS[tier] ?? null
}

/** All tier names whose threshold has been crossed, ascending */
export function tiersEarned(cumulativeSpend) {
  return TIER_THRESHOLDS.filter((t) => t.tier !== "free" && cumulativeSpend >= t.min)
    .map((t) => t.tier)
    .reverse()
}

/**
 * Tier progress for UI: {tier, nextTier, nextMin (string wei), progressBps}.
 * progressBps = position between current floor and next threshold (0..10000).
 */
export function tierProgress(cumulativeSpend) {
  const tier = getTier(cumulativeSpend)
  const idx = TIER_THRESHOLDS.findIndex((t) => t.tier === tier)
  const current = TIER_THRESHOLDS[idx]
  const next = idx > 0 ? TIER_THRESHOLDS[idx - 1] : null
  if (!next) return { tier, nextTier: null, nextMin: null, progressBps: 10000 }
  const floor = current?.min ?? 0n
  const span = next.min - floor
  const bps = span > 0n ? Number(((cumulativeSpend - floor) * 10_000n) / span) : 10000
  return {
    tier,
    nextTier: next.tier,
    nextMin: next.min.toString(),
    progressBps: Math.min(Math.max(bps, 0), 10000),
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/src/lib/billing-core.test.js`
Expected: PASS 全部（含既有）

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/lib/billing-core.js workers/billing/src/lib/billing-core.test.js
git commit -m "feat(billing): tier engine — whale tier, badge id map, tier progress (M2 §5)"
```

---

## Task 4: 等级提升检测 + pending 徽章 + /v1/tier 端点

**Files:**
- Modify: `workers/billing/src/index.js`
- Test: `workers/billing/src/index.test.js`

- [ ] **Step 1: 写失败测试（index.test.js 追加）**

> 注：`handleUsage` 已在文件顶部导入。将顶部 `import { handleUsage } from "./index.js"` 改为 `import { computePendingBadges, handleUsage } from "./index.js"`，不要重复 import 语句。

```js
describe("M2 pending tier badges", () => {
  it("marks newly earned tiers as pending", () => {
    const spend = 5_000n * 10n ** 18n // below bronze
    expect(computePendingBadges(spend, [])).toEqual([])
    const crossed = 10_500n * 10n ** 18n // bronze crossed
    expect(computePendingBadges(crossed, [])).toEqual(["bronze"])
    // silver also crossed, bronze already minted
    const both = 105_000n * 10n ** 18n
    expect(computePendingBadges(both, ["bronze"])).toEqual(["silver"])
  })

  it("usage response exposes tier after crossing", async () => {
    const ledger = {
      onchainSnapshot: 10_000_000_000_000_000_000_000_000n, // 10M credit
      committedUsage: 0n,
      cumulativeSpend: 9_999n * 10n ** 18n,
    }
    const res = await handleUsage({ model: "demo", tokens: 1000n }, ledger)
    expect(res.status).toBe(200)
    expect(res.body.tier).toBe("bronze") // crossed 10k credit
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: FAIL — computePendingBadges 未导出 / tier 未提升

- [ ] **Step 3: 实现（index.js）**

`handleUsage` 中，将 tier 计算改为消费后判定（替换 `const tier = getTier(ledger.cumulativeSpend ?? 0n)` 一行）：

```js
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
```

在文件顶部 `withLedgerLock` 之前新增纯函数：

```js
/** Tiers earned but not yet minted (spec §5: platform mints on crossing) */
export function computePendingBadges(cumulativeSpend, mintedTierBadges = []) {
  return tiersEarned(cumulativeSpend).filter((t) => !mintedTierBadges.includes(t))
}
```

import 区补 `tiersEarned`：

```js
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
```

在 `/v1/usage` 的写回逻辑中持久化等级字段（替换现有 put 的 JSON.stringify 块）：

```js
            await env.CINA_BILLING_KV.put(
              `ledger:${keyRow.address}`,
              JSON.stringify({
                ...stored,
                onchainSnapshot: snapshot.toString(),
                committedUsage: updated.committedUsage.toString(),
                cumulativeSpend: updated.cumulativeSpend.toString(),
                tier,
                pendingTierBadges: res.body.pendingBadges,
              })
            )
```

- [ ] **Step 4: 新增 GET /v1/tier/:address 端点（index.js，放在 /v1/credits 路由后）**

```js
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
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run workers/billing/`
Expected: PASS 全部

- [ ] **Step 6: Commit**

```bash
git add workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): tier upgrade detection, pending badges, /v1/tier endpoint (M2 §5)"
```

---

## Task 5: 链上等级徽章 — 设置脚本（createBadgeType 100-104）+ spec 修正

**Files:**
- Create: `scripts/setup-tier-badges.mjs`
- Modify: `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md`（§3.2 徽章 ID 表）

- [ ] **Step 1: 实现 scripts/setup-tier-badges.mjs**

```js
/**
 * 创建 5 个等级徽章类型（CinaBadge IDs 100-104，soulbound）。
 * CinaBadge.nextCustomBadgeId 从 100 起，按创建顺序分配。
 * 用法: DEPLOY_PRIVATE_KEY=0x... CINA_BADGE_CONTRACT=0x... node scripts/setup-tier-badges.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BADGE = process.env.CINA_BADGE_CONTRACT || "0x72cc9adb6c877d233e9843ee2d00424b9766d0cf"
const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")

const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

const BADGE_ABI = [
  { name: "createBadgeType", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }, { name: "description", type: "string" },
             { name: "soulbound", type: "bool" }, { name: "maxSupply", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "badgeTypeCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
]

const TIERS = [
  { name: "Bronze", description: "累计消耗 1 万 Credit", },
  { name: "Silver", description: "累计消耗 10 万 Credit", },
  { name: "Gold", description: "累计消耗 100 万 Credit", },
  { name: "Diamond", description: "累计消耗 1000 万 Credit", },
  { name: "Whale", description: "累计消耗 1 亿 Credit", },
]

const count = await publicClient.readContract({ address: BADGE, abi: BADGE_ABI, functionName: "badgeTypeCount" })
// count = 5 标准 + custom；已创建 5 个自定义则跳过
const custom = Number(count) - 5
if (custom >= 5) {
  console.log(`✔ 等级徽章已存在（custom count=${custom}），预期 IDs 100-104，跳过`)
  process.exit(0)
}
for (let i = custom; i < 5; i++) {
  const t = TIERS[i]
  const hash = await wallet.writeContract({
    address: BADGE, abi: BADGE_ABI, functionName: "createBadgeType",
    args: [t.name, t.description, true, 0n], // soulbound, unlimited
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✔ ${t.name} badge created id=#${100 + i} tx=${hash}`)
}
```

- [ ] **Step 2: 修正 spec §3.2 徽章 ID 表（改为 100-104）**

将 spec 中等级徽章表：

```markdown
| 等级徽章 ID | 名称 | 累计消耗门槛 |
|---|---|---|
| 10 | Bronze 青铜 | 1 万 Credit |
| 11 | Silver 白银 | 10 万 Credit |
| 12 | Gold 黄金 | 100 万 Credit |
| 13 | Diamond 钻石 | 1000 万 Credit |
| 14 | Whale 巨鲸 | 1 亿 Credit |
```

替换为：

```markdown
| 等级徽章 ID | 名称 | 累计消耗门槛 |
|---|---|---|
| 100 | Bronze 青铜 | 1 万 Credit |
| 101 | Silver 白银 | 10 万 Credit |
| 102 | Gold 黄金 | 100 万 Credit |
| 103 | Diamond 钻石 | 1000 万 Credit |
| 104 | Whale 巨鲸 | 1 亿 Credit |

> 注：CinaBadge 自定义徽章 ID 从 100 起（`nextCustomBadgeId = 100`），故等级徽章为 100-104。
```

同步修正 §5 表格中的徽章列（`#10`→`#100`、`#11`→`#101`、`#12`→`#102`、`#13`→`#103`、`#14`→`#104`）。

- [ ] **Step 3: 运行设置脚本（需要 owner key）**

Run: `DEPLOY_PRIVATE_KEY=0x... CINA_BADGE_CONTRACT=0x72cc9adb6c877d233e9843ee2d00424b9766d0cf node scripts/setup-tier-badges.mjs`
Expected: 5 行 `✔ X badge created id=#10X tx=0x...`

- [ ] **Step 4: 提交**

```bash
git add scripts/setup-tier-badges.mjs docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md
git commit -m "feat(billing): tier badge setup script (IDs 100-104) + spec correction (M2 §3.2)"
```

---

## Task 6: 铸造脚本 + admin 端点（pending 列表 / 确认铸造）

**Files:**
- Create: `scripts/mint-tier-badges.mjs`
- Modify: `workers/billing/src/index.js`
- Test: `workers/billing/src/index.test.js`

- [ ] **Step 1: 写失败测试（index.test.js 追加，用 fetch 打桩测路由）**

> 注：`billingWorker` 已在 Task 2 Step 8 导入（`import billingWorker from "./index.js"`），本任务直接复用，**不要重复 import**。

```js
// 追加到 workers/billing/src/index.test.js
function makeEnv() {
  const store = new Map()
  return {
    ADMIN_KEY: "test-admin",
    CINA_BILLING_KV: {
      async get(k) { return store.has(k) ? store.get(k) : null },
      async put(k, v) { store.set(k, v) },
      async list({ prefix } = {}) {
        return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }
      },
    },
    store,
  }
}

async function callWorker(env, req) {
  return billingWorker.fetch(req, env)
}

describe("M2 admin endpoints", () => {
  it("GET /v1/admin/pending-badges lists ledgers with pending tier badges", async () => {
    const env = makeEnv()
    env.store.set("ledger:0xaaa", JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0",
      cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    env.store.set("ledger:0xbbb", JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0", cumulativeSpend: "0",
      pendingTierBadges: [], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/admin/pending-badges", {
      headers: { "X-Admin-Key": "test-admin" },
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pending).toHaveLength(1)
    expect(body.pending[0].address).toBe("0xaaa")
    expect(body.pending[0].badges).toEqual(["bronze"])
  })

  it("rejects pending-badges without admin key", async () => {
    const res = await callWorker(makeEnv(), new Request("https://billing.test/v1/admin/pending-badges"))
    expect(res.status).toBe(401)
  })

  it("POST /v1/admin/badges/:address/:tier confirms a minted badge", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    env.store.set(`ledger:${ADDR}`, JSON.stringify({
      onchainSnapshot: "0", committedUsage: "0",
      cumulativeSpend: (20_000n * 10n ** 18n).toString(),
      pendingTierBadges: ["bronze"], mintedTierBadges: [],
    }))
    const res = await callWorker(env, new Request(`https://billing.test/v1/admin/badges/${ADDR}/bronze/confirm`, {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: "0xabc" }),
    }))
    expect(res.status).toBe(200)
    const ledger = JSON.parse(env.store.get(`ledger:${ADDR}`))
    expect(ledger.pendingTierBadges).toEqual([])
    expect(ledger.mintedTierBadges).toEqual(["bronze"])
    expect(ledger.badgeTxHashes).toEqual({ bronze: "0xabc" })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: FAIL — 404

- [ ] **Step 3: 实现 admin 端点（index.js，/v1/admin/index 路由前插入）**

```js
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
        const ledger = JSON.parse(raw)
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
        const ledger = raw ? JSON.parse(raw) : {}
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
```

import 补 `listAllKeys`：

```js
import { runIndexer, listAllKeys } from "./lib/indexer-run.js"
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/`
Expected: PASS 全部

- [ ] **Step 5: 实现 scripts/mint-tier-badges.mjs**

```js
/**
 * 读取 worker pending 等级徽章 → owner 链上铸造 → 回写确认。
 * 用法: DEPLOY_PRIVATE_KEY=0x... BILLING_URL=... ADMIN_KEY=... node scripts/mint-tier-badges.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BILLING_URL = process.env.BILLING_URL || "https://cinachain-billing.cinagroup.workers.dev"
const ADMIN_KEY = process.env.ADMIN_KEY
const BADGE = process.env.CINA_BADGE_CONTRACT || "0x72cc9adb6c877d233e9843ee2d00424b9766d0cf"
const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
if (!PK || !ADMIN_KEY) throw new Error("DEPLOY_PRIVATE_KEY and ADMIN_KEY required")

const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

const MINT_ABI = [
  { name: "mint", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: [] },
]

// tier -> badge id（与 billing-core TIER_BADGE_IDS 一致）
const TIER_IDS = { bronze: 100n, silver: 101n, gold: 102n, diamond: 103n, whale: 104n }

const res = await fetch(`${BILLING_URL}/v1/admin/pending-badges`, { headers: { "X-Admin-Key": ADMIN_KEY } })
if (!res.ok) throw new Error(`pending-badges ${res.status}: ${await res.text()}`)
const { pending } = await res.json()
if (!pending.length) { console.log("✔ 无待铸造等级徽章"); process.exit(0) }

for (const item of pending) {
  for (const tier of item.badges) {
    const hash = await wallet.writeContract({
      address: BADGE, abi: MINT_ABI, functionName: "mint",
      args: [item.address, TIER_IDS[tier], 1n],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`✔ ${tier} badge -> ${item.address} tx=${hash}`)
    const confirm = await fetch(
      `${BILLING_URL}/v1/admin/badges/${item.address}/${tier}/confirm`,
      {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      }
    )
    if (!confirm.ok) console.warn(`⚠ confirm failed for ${tier} ${item.address}: ${await confirm.text()}`)
  }
}
console.log("✔ 全部等级徽章已铸造并确认")
```

- [ ] **Step 6: Commit**

```bash
git add scripts/mint-tier-badges.mjs workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): admin pending/confirm endpoints + tier badge mint script (M2 §5)"
```

---

## Task 7: 托管账户 — KV 记账 + 端点 + usage 支持

**Files:**
- Modify: `workers/billing/src/index.js`
- Test: `workers/billing/src/index.test.js`

- [ ] **Step 1: 写失败测试（index.test.js 追加）**

> 注：`makeEnv`/`callWorker` 已在 Task 6 Step 1 定义（同文件），直接复用，不要重复定义。

```js
// 追加到 workers/billing/src/index.test.js
describe("M2 custodial accounts", () => {
  it("POST /v1/custodial/accounts creates a DB-backed account", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^cust_[a-f0-9]{16}$/)
    const stored = JSON.parse(env.store.get(`cust:${body.id}`))
    expect(stored.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(stored.balanceWei).toBe("0")
  })

  it("admin credits a custodial account (pool funds already on-chain)", async () => {
    const env = makeEnv()
    env.store.set("cust:test1", JSON.stringify({ owner: "0xaaa", balanceWei: "0", committedUsage: "0", cumulativeSpend: "0" }))
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: (100n * 10n ** 18n).toString() }),
    }))
    expect(res.status).toBe(200)
    const stored = JSON.parse(env.store.get("cust:test1"))
    expect(stored.balanceWei).toBe((100n * 10n ** 18n).toString())
  })

  it("credits a custodial account without admin key", async () => {
    const env = makeEnv()
    const res = await callWorker(env, new Request("https://billing.test/v1/custodial/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test1", amountWei: "1" }),
    }))
    expect(res.status).toBe(401)
  })

  it("usage accepts a key bound to a custodial account", async () => {
    const env = makeEnv()
    env.store.set("cust:c1", JSON.stringify({
      owner: "0xaaa", balanceWei: (10n * 10n ** 18n).toString(),
      committedUsage: "0", cumulativeSpend: "0",
    }))
    // keyRow stores the SHA-256 HASH of the raw api key (never the raw key)
    const data = new TextEncoder().encode("keyvalue")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "cust", custId: "c1" }))

    const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "keyvalue", model: "demo", tokens: 1000n }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // 10 credit balance, 2 credit charge -> 8 credit remaining (8e18 wei)
    expect(body.remainingWei).toBe("8000000000000000000")
    const stored = JSON.parse(env.store.get("cust:c1"))
    expect(stored.committedUsage).toBe("2000000000000000000")
    // DB balance itself unchanged — usage is committed server-side
    expect(stored.balanceWei).toBe((10n * 10n ** 18n).toString())
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: FAIL — 404

- [ ] **Step 3: 实现（index.js）**

在 `/v1/keys` 路由前插入托管端点：

```js
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
```

修改 `/v1/keys`（支持绑定托管账户，address/custId 二选一）：

```js
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
```

修改 `/v1/usage` 的 key 解析与账本读取（替换现有 keyRow 读取 + withLedgerLock 块），支持两种 key：

```js
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/`
Expected: PASS 全部（custodial 组 4 项）

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): custodial accounts — KV bookkeeping, admin credit, key binding, usage (M2 §6)"
```

---

## Task 8: 托管池脚本 + 前端等级进度 + 管理后台

**Files:**
- Create: `scripts/custodial-pool.mjs`
- Create: `lib/hooks/use-tier-progress.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/admin/billing/page.tsx`

- [ ] **Step 1: 实现 scripts/custodial-pool.mjs**

```js
/**
 * 托管池工具：生成池钱包（本地保存）、owner 向池 mintTo 注资、池向用户转账（提现）。
 * 用法:
 *   node scripts/custodial-pool.mjs gen            # 生成池私钥（打印，自行保存）
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/custodial-pool.mjs fund <pool> <creditAmount>
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/custodial-pool.mjs withdraw <poolKey> <to> <creditAmount>
 */
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"

const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
const CREDIT = process.env.CINA_CREDIT_CONTRACT || "0x78f5aebc75b7d197b10622cccabe8429617836d7"
const MODE = process.argv[2]
const chain = baseSepolia

const CREDIT_ABI = [
  { name: "mintTo", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
]

if (MODE === "gen") {
  console.log(`池私钥（妥善保存，勿提交仓库）: ${generatePrivateKey()}`)
  process.exit(0)
}

const PK = process.env.DEPLOY_PRIVATE_KEY || (MODE === "withdraw" ? process.argv[3] : null)
if (!PK) throw new Error("需要 DEPLOY_PRIVATE_KEY（fund）或池私钥（withdraw）")
const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain, transport: http(RPC) })
const publicClient = createPublicClient({ chain, transport: http(RPC) })

if (MODE === "fund") {
  const pool = process.argv[3]
  const credits = parseEther(process.argv[4] ?? "1") // 1 credit = 1e18
  const hash = await wallet.writeContract({ address: CREDIT, abi: CREDIT_ABI, functionName: "mintTo", args: [pool, credits] })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✔ 已向池 ${pool} 注资 ${process.argv[4] ?? "1"} credit tx=${hash}`)
} else if (MODE === "withdraw") {
  const poolKey = process.argv[3]
  const to = process.argv[4]
  const credits = parseEther(process.argv[5] ?? "1")
  const pool = privateKeyToAccount(poolKey)
  const poolWallet = createWalletClient({ account: pool, chain, transport: http(RPC) })
  const hash = await poolWallet.writeContract({ address: CREDIT, abi: CREDIT_ABI, functionName: "transfer", args: [to, credits] })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✔ 池已转 ${process.argv[5] ?? "1"} credit -> ${to} tx=${hash}`)
  // 提示：链上转账后应调用 POST /v1/custodial/debit 扣减 DB 余额（见 admin UI）
} else {
  console.error("用法: gen | fund <pool> <credits> | withdraw <poolKey> <to> <credits>")
  process.exit(1)
}
```

- [ ] **Step 2: 实现 lib/hooks/use-tier-progress.ts**

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://cinachain-billing.cinagroup.workers.dev"

export interface TierProgress {
  address: string
  tier: string
  cumulativeSpend: string
  nextTier: string | null
  nextThreshold: string | null
  progressBps: number
  pendingBadges: string[]
  mintedBadges: string[]
}

export function useTierProgress(address?: Address) {
  return useQuery({
    queryKey: ["tier", address],
    queryFn: async (): Promise<TierProgress> => {
      const res = await fetch(`${BILLING_API_URL}/v1/tier/${address}`)
      if (!res.ok) throw new Error(`tier lookup failed: ${res.status}`)
      return res.json()
    },
    enabled: !!address,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: 修改 app/dashboard/page.tsx — 等级进度卡片**

在 `StatCard` 组件后新增：

```tsx
function TierProgressCard({ address }: { address?: Address }) {
  const { data, isLoading } = useTierProgress(address)
  const TIER_LABEL: Record<string, string> = {
    free: "Free", bronze: "Bronze", silver: "Silver",
    gold: "Gold", diamond: "Diamond", whale: "Whale",
  }
  const spendCredits = data
    ? (Number(data.cumulativeSpend) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0"
  return (
    <Card className="shadow-vercel-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Membership Tier
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl text-foreground">
                {TIER_LABEL[data.tier] ?? data.tier}
              </span>
              <span className="text-xs text-muted-foreground">
                {spendCredits} credit spent
              </span>
            </div>
            {data.nextTier ? (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7928ca] to-[#0070f3]"
                    style={{ width: `${data.progressBps / 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {((Number(data.nextThreshold ?? 0) / 1e18) / 10000).toLocaleString()} credit to{" "}
                  {TIER_LABEL[data.nextTier] ?? data.nextTier}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Top tier reached</p>
            )}
            {data.pendingBadges.length > 0 && (
              <p className="mt-2 text-xs font-medium text-violet">
                🎖 Badge pending: {data.pendingBadges.join(", ")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

在 `PageDashboard` 组件内（现有 StatCard 网格后）插入：

```tsx
      {address && <TierProgressCard address={address} />}
```

并在 import 区补：

```tsx
import { useTierProgress } from "@/lib/hooks/use-tier-progress"
import type { Address } from "viem"
```

- [ ] **Step 4: 修改 app/admin/billing/page.tsx — 等级徽章铸造区**

在 `<Card>` 网格（Ledger card 之后）插入铸造卡片（复用现有 writeContract 模式）：

```tsx
      {/* Tier badge minting (spec §5: platform mints on tier crossing) */}
      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5" />
            Tier Badge Minting
          </CardTitle>
          <CardDescription>
            Addresses that crossed a tier threshold but have no on-chain badge yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Admin key"
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="max-w-[240px]"
            />
            <Button variant="outline" size="sm" onClick={fetchPending} disabled={isFetchingPending}>
              {isFetchingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
          {pendingList.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {isFetchingPending ? "Loading..." : "No pending tier badges"}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingList.map((item) => (
                <li key={item.address} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="font-mono-tech text-xs text-foreground">{item.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.badges.join(", ")} · cumulative {(Number(item.cumulativeSpend) / 1e18).toLocaleString()} credit
                    </p>
                  </div>
                  <Button size="sm" onClick={() => mintPending(item)} disabled={isBusy || !adminKey}>
                    Mint
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
```

状态与逻辑（在组件顶部 state 区追加）：

```tsx
  // Tier badge minting
  const [adminKey, setAdminKey] = useState("")
  const [pendingList, setPendingList] = useState<Array<{ address: string; badges: string[]; cumulativeSpend: string }>>([])
  const [isFetchingPending, setIsFetchingPending] = useState(false)
  const [badgeError, setBadgeError] = useState<string | null>(null)

  const fetchPending = async () => {
    setIsFetchingPending(true)
    setBadgeError(null)
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/admin/pending-badges`, {
        headers: { "X-Admin-Key": adminKey },
      })
      if (!res.ok) throw new Error(`pending-badges ${res.status}`)
      const body = await res.json()
      setPendingList(body.pending ?? [])
    } catch (err) {
      setBadgeError(err instanceof Error ? err.message : "Failed to load pending badges")
    } finally {
      setIsFetchingPending(false)
    }
  }

  const BADGE_MINT_ABI = [
    { name: "mint", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }],
      outputs: [] },
  ] as const
  const TIER_IDS: Record<string, bigint> = { bronze: 100n, silver: 101n, gold: 102n, diamond: 103n, whale: 104n }
  const BADGE_CONTRACT = process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT || "0x72cc9adb6c877d233e9843ee2d00424b9766d0cf"

  const mintPending = async (item: { address: string; badges: string[] }) => {
    setBadgeError(null)
    try {
      for (const tier of item.badges) {
        const hash = await writeContractAsync({
          address: BADGE_CONTRACT as Address,
          abi: BADGE_MINT_ABI,
          functionName: "mint",
          args: [item.address as Address, TIER_IDS[tier], 1n],
        })
        await fetch(`${BILLING_API_URL}/v1/admin/badges/${item.address}/${tier}/confirm`, {
          method: "POST",
          headers: { "X-Admin-Key": adminKey, "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: hash }),
        })
      }
      setSuccessAction("Tier badges minted")
      await fetchPending()
    } catch (err) {
      const anyErr = err as unknown as { shortMessage?: string; message?: string }
      setBadgeError(anyErr.shortMessage ?? anyErr.message ?? "Failed to mint badge")
    }
  }
```

import 区补 `Address`（如无）、`BadgeCheck`（已 import）、`useTierProgress` 不需要。

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 构建成功（静态导出无错误）

- [ ] **Step 6: Commit**

```bash
git add scripts/custodial-pool.mjs lib/hooks/use-tier-progress.ts app/dashboard/page.tsx app/admin/billing/page.tsx
git commit -m "feat(billing): pool tooling, dashboard tier progress, admin badge mint UI (M2 §5-7)"
```

---

## Task 9: E2E 验证 — 索引器 + 等级徽章 + 托管账户全链路

**Files:**
- Modify: 无（验证任务）

- [ ] **Step 1: 部署 worker**

```bash
cd workers/billing && npx wrangler deploy
```
Expected: 部署成功，触发 cron 每 1 分钟运行

- [ ] **Step 2: 冒烟 — health + 手动索引器**

```bash
curl -s https://cinachain-billing.cinagroup.workers.dev/health
curl -s -X POST https://cinachain-billing.cinagroup.workers.dev/v1/admin/index -H "X-Admin-Key: cinachain-admin-dev-2026"
```
Expected: `{"ok":true,...}`；`{"scanned":"0",...}` 或小范围扫描结果

- [ ] **Step 3: 冒烟 — 链上转账反映到快照**

1. 记录地址 A 的 ledger snapshot（GET /v1/credits/:address）
2. 从 A 转出部分 CinaCredit 到 B（脚本/钱包）
3. `curl -X POST .../v1/admin/index` 手动触发一次
4. GET /v1/credits/:address → onchainSnapshot 已下降

- [ ] **Step 4: 冒烟 — 等级提升与 pending 徽章**

1. 用 admin 端点直接写一个高累计消耗 ledger（或真实消费），如累计 2 万 credit：
   `curl -X POST .../v1/admin/ledger`（若未实现，用 usage 多次消费或 KV 直写）
2. GET /v1/tier/:address → tier=bronze, pendingBadges=["bronze"]
3. 运行 `node scripts/setup-tier-badges.mjs`（首次）
4. 运行 `node scripts/mint-tier-badges.mjs` → 链上铸造 + 确认
5. GET /v1/tier/:address → mintedBadges=["bronze"], pendingBadges=[]

- [ ] **Step 5: 冒烟 — 托管账户**

1. `curl -X POST .../v1/custodial/accounts -d '{"owner":"0x..."}'` → 得到 id
2. admin credit 100 credit
3. 绑定 key: `POST /v1/keys {"apiKey":"...","custId":"..."}`
4. `POST /v1/usage` 用该 key → 扣费、余额下降
5. GET /v1/custodial/:id → usable 正确

- [ ] **Step 6: 浏览器验证**

- `/dashboard` 等级进度卡片显示（连接钱包）
- `/admin/billing` 等级徽章铸造区渲染正常

---

## Task 10: 文档更新 + 最终收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md`（§8 M2 状态行）

- [ ] **Step 1: 更新 spec §8 M2 行状态**

将：

```markdown
| **M2** | 事件索引对账 + 托管账户（热钱包池 + DB） + 会员等级（累计消耗 → 等级 → 徽章发放） | 转账/转出实时反映额度；等级达标自动发徽章 |
```

替换为：

```markdown
| **M2** | 事件索引对账 + 托管账户（热钱包池 + DB） + 会员等级（累计消耗 → 等级 → 徽章发放） | 转账/转出实时反映额度；等级达标自动发徽章 ✅ 已完成（2026-08-04，M2 分支 feat/credit-billing-m2） |
```

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md
git commit -m "docs(billing): M2 complete — indexer, tiers, custodial accounts (spec §8)"
```
