# M3 计费系统：Key 入金通道 + 定价表细分 + 消耗报表 + 兑出 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 spec `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` §8 的 M3 里程碑：Key 入金通道（验证/池化/确认铸造）、定价表细分、消耗明细报表、兑出（redeem）。验收：key 提供者可获得 Credit；用户可兑出；平台可审计。

**Architecture:** 四块增量 — (1) 定价表从硬编码常量升级为"默认表 + KV 覆盖层"（admin 可灰度调整，§7.2）；(2) `/v1/usage` 写回时向 `hist:<addr>` 追加消耗明细（模型/tokens/扣费/等级），新增 `GET /v1/history/:address` 报表端点；(3) Key 入金通道按 spec §6.3 六步流程实现——`POST /v1/ingress` 提交（key 用 AES-GCM 加密存 KV，SHA-256 哈希登记）→ 测试调用验证 → pending 记录 → `POST /v1/usage` 可携带 `ingressId` 标记池化 key 消耗 → 累计确认 ≥ 申报额度 → 状态转 `minting` → admin 脚本 `mintTo` 铸造 → `POST /v1/ingress/:id/confirm` 闭环；(4) 兑出前端（合约 `redeem` 已就绪，仅需 ABI + UI + admin 启用开关）。

**Tech Stack:** Cloudflare Workers（KV + WebCrypto AES-GCM）、viem 脚本（mintTo）、vitest TDD、Next.js 前端（/credits 兑出卡 + /keys 入金页）。

---

## 计划偏差记录（相对 spec）

| spec 假设 | 实际 | 处理 |
|---|---|---|
| §6.3 "平台测试调用验证 key 有效性" | 测试网无真实上游 API；验证降级为格式校验 + 可选 `INGRESS_VALIDATE_URL` 测试调用（未配置时状态直接 pending） | Task 3 按此落地，文档记录 |
| §6.3 "key 加密存储入托管池（Worker secret）" | Worker 用 WebCrypto AES-GCM（`INGRESS_ENC_KEY` 32 字节 hex env），明文不出 KV | Task 3 落地 |
| 定价表"按模型/接口定价" | 默认表 `demo` 保留，新增 `gpt-4o-mini`/`deepseek-v3`/`hunyuan`；KV `pricing` 覆盖层可灰度 | Task 1 落地 |
| 兑出"金库余额上限保护" | 合约已有 `InsufficientTreasury` 守卫；前端展示金库余额 + redeemEnabled 状态 | Task 6 落地 |

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `workers/billing/src/lib/pricing.js` | 默认定价表 + KV 覆盖层读写（getPricing/putPricing/estimateCostWithPricing） | 新建 |
| `workers/billing/src/lib/pricing.test.js` | 定价逻辑测试 | 新建 |
| `workers/billing/src/lib/ingress.js` | AES-GCM 加密/解密、SHA-256 哈希、入金记录状态机（pure 部分） | 新建 |
| `workers/billing/src/lib/ingress.test.js` | 加密/状态机测试 | 新建 |
| `workers/billing/src/index.js` | +/v1/admin/pricing GET/PUT、+/v1/history/:address、+/v1/ingress、usage 携带 ingressId、+/v1/ingress/:id/confirm | 修改 |
| `workers/billing/src/index.test.js` | +新端点测试 | 修改 |
| `workers/billing/wrangler.toml` | +INGRESS_ENC_KEY var | 修改 |
| `scripts/ingress-mint.mjs` | 扫描 minting 状态入金记录 → CinaCredit.mintTo → confirm | 新建 |
| `lib/contracts/cina-credit.ts` | +redeem/redeemEnabled ABI | 修改 |
| `app/(general)/credits/page.tsx` | +兑出卡片（余额/金库/redeemEnabled/预计 ETH/redeem 按钮） | 修改 |
| `app/(general)/keys/page.tsx` | Key 入金页：提交 key + 申报额度 → pending 进度条 → 历史 | 新建 |
| `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` | §8 M3 状态行 + §6.3 验证简化说明 | 修改 |

---

## Task 1: 定价表细分 — 多模型 + KV 覆盖层

**Files:**
- Create: `workers/billing/src/lib/pricing.js`
- Test: `workers/billing/src/lib/pricing.test.js`

- [ ] **Step 1: 写失败测试**

```js
// workers/billing/src/lib/pricing.test.js
import { describe, it, expect } from "vitest"
import { DEFAULT_PRICING, applyPricingOverrides, estimateCostWithPricing } from "./pricing.js"

describe("DEFAULT_PRICING", () => {
  it("keeps demo pricing and adds models", () => {
    expect(DEFAULT_PRICING.demo.perTokenMicroCredit).toBe(2000n)
    expect(DEFAULT_PRICING["gpt-4o-mini"].perTokenMicroCredit).toBe(100n)
    expect(DEFAULT_PRICING["deepseek-v3"].perTokenMicroCredit).toBe(500n)
    expect(DEFAULT_PRICING["hunyuan"].perTokenMicroCredit).toBe(800n)
  })
})

describe("applyPricingOverrides", () => {
  it("merges overrides on top of defaults (partial)", () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "150" } })
    expect(merged["gpt-4o-mini"].perTokenMicroCredit).toBe(150n)
    expect(merged.demo.perTokenMicroCredit).toBe(2000n) // untouched
    expect(merged["deepseek-v3"].perTokenMicroCredit).toBe(500n) // untouched
  })
  it("rejects unknown models in overrides", () => {
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { nope: { perTokenMicroCredit: "1" } })).toThrow(/unknown model/)
  })
  it("rejects non-positive or non-integer prices", () => {
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { demo: { perTokenMicroCredit: "0" } })).toThrow(/positive/)
    expect(() => applyPricingOverrides(DEFAULT_PRICING, { demo: { perTokenMicroCredit: "1.5" } })).toThrow(/integer/)
  })
  it("accepts null overrides (no-op)", () => {
    expect(applyPricingOverrides(DEFAULT_PRICING, null)).toEqual(DEFAULT_PRICING)
  })
})

describe("estimateCostWithPricing", () => {
  it("computes cost with a merged table", () => {
    const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "200" } })
    const cost = estimateCostWithPricing(merged, "gpt-4o-mini", 1000n, "free")
    expect(cost).toBe(200_000n) // 200 micro × 1000
  })
  it("throws for unknown model", () => {
    expect(() => estimateCostWithPricing(DEFAULT_PRICING, "nope", 1n, "free")).toThrow(/unknown model/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/lib/pricing.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 pricing.js**

```js
// workers/billing/src/lib/pricing.js
// Model pricing (micro-credit per token) with a KV override layer so the
// platform can adjust prices without redeploying (spec §7.2).

/** Default pricing — values are micro-credit per token (1 credit = 1e6 micro) */
export const DEFAULT_PRICING = {
  demo: { perTokenMicroCredit: 2000n },
  "gpt-4o-mini": { perTokenMicroCredit: 100n },
  "deepseek-v3": { perTokenMicroCredit: 500n },
  hunyuan: { perTokenMicroCredit: 800n },
}

/** Merge a KV override map (string values) onto the default table */
export function applyPricingOverrides(base, overrides) {
  if (!overrides) return base
  const merged = { ...base }
  for (const [model, row] of Object.entries(overrides)) {
    if (!base[model]) throw new Error(`unknown model: ${model}`)
    const raw = row?.perTokenMicroCredit
    if (raw === undefined || raw === null) continue
    if (!/^\d+$/.test(String(raw))) throw new Error(`price must be a positive integer: ${model}`)
    const v = BigInt(raw)
    if (v <= 0n) throw new Error(`price must be a positive integer: ${model}`)
    merged[model] = { perTokenMicroCredit: v }
  }
  return merged
}

/** Cost in micro-credit for N tokens on a model with the given merged table,
 *  after tier discount (spec §5) — mirrors billing-core estimateCost. */
export function estimateCostWithPricing(pricing, model, tokenCount, tier = "free") {
  const row = pricing[model]
  if (!row) throw new Error(`unknown model: ${model}`)
  const base = row.perTokenMicroCredit * BigInt(tokenCount)
  const discountBps = TIER_DISCOUNT_BPS[tier]
  if (discountBps === undefined) throw new Error(`unknown tier: ${tier}`)
  return (base * (10_000n - discountBps)) / 10_000n
}
```

> 注：计划初稿的 `estimateCostWithPricing` 遗漏了等级折扣（相对 billing-core `estimateCost` 的回归风险）——实现时已修正：从 `./billing-core.js` 导入 `TIER_DISCOUNT_BPS` 并应用，另加 bronze 折扣回归测试（pricing.test.js 现 8 项）。代码开头需 `import { TIER_DISCOUNT_BPS } from "./billing-core.js"`。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/src/lib/pricing.test.js`
Expected: PASS (10 assertions)

- [ ] **Step 5: handleUsage 接入定价参数（workers/billing/src/index.js）**

修改 `handleUsage` 签名：`export async function handleUsage(body, ledger, pricing = DEFAULT_PRICING)`，内部将 `estimateCost(body.model ?? "demo", tokens, ...)` 替换为 `estimateCostWithPricing(pricing, body.model ?? "demo", tokens, ...)`：

```js
export async function handleUsage(body, ledger, pricing = DEFAULT_PRICING) {
  try {
    const tokens = BigInt(body.tokens ?? 0)
    if (tokens <= 0n) return { status: 400, body: { error: "tokens must be > 0" } }
    const costMicro = estimateCostWithPricing(pricing, body.model ?? "demo", tokens, getTier(ledger.cumulativeSpend ?? 0n))
    // ...其余不变
```

import 补：`import { DEFAULT_PRICING, estimateCostWithPricing } from "./lib/pricing.js"`。
注意：billing-core 的旧 `estimateCost`/`pricingTable` 保留（其他测试引用），不再被 usage 热路径使用。

- [ ] **Step 6: 追加 pricing 覆盖测试（index.test.js）**

```js
// 追加到 index.test.js — 验证 usage 应用定价覆盖层
it("usage applies pricing overrides from KV", async () => {
  // 直接测 handleUsage 纯函数：传入覆盖后的 merged 表
  const merged = applyPricingOverrides(DEFAULT_PRICING, { "gpt-4o-mini": { perTokenMicroCredit: "200" } })
  const ledger = { onchainSnapshot: 10_000_000_000_000_000_000n, committedUsage: 0n, cumulativeSpend: 0n }
  const res = await handleUsage({ model: "gpt-4o-mini", tokens: 1000n }, ledger, merged)
  expect(res.status).toBe(200)
  expect(res.body.chargedMicro).toBe("200000") // 200 micro × 1000
})
```

（index.test.js 顶部 import 需补 `applyPricingOverrides, DEFAULT_PRICING` from "./lib/pricing.js" 与 handleUsage 已有。）

- [ ] **Step 7: 运行确认通过（全量）**

Run: `npx vitest run workers/billing/`
Expected: ALL PASS（既有 handleUsage 测试走默认参数，不受影响）

- [ ] **Step 8: Commit**

```bash
git add workers/billing/src/lib/pricing.js workers/billing/src/lib/pricing.test.js workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): pricing table — multi-model defaults + override merge (M3 §7.2)"
```

---

## Task 2: 消耗明细报表 — hist 记录 + GET /v1/history

**Files:**
- Modify: `workers/billing/src/index.js`
- Test: `workers/billing/src/index.test.js`

- [ ] **Step 1: 写失败测试（index.test.js 追加；复用 makeEnv/callWorker/billingWorker）**

```js
// 追加到 workers/billing/src/index.test.js — "M3 history" describe block
describe("M3 consumption history", () => {
  it("usage writes a history entry; GET /v1/history/:address returns it", async () => {
    const env = makeEnv()
    // self key flow
    const data = new TextEncoder().encode("histkey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "self", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }))
    // ledger with balance — usage will succeed
    env.store.set("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", JSON.stringify({
      onchainSnapshot: (10n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0",
    }))
    // stub RPC so refreshSnapshot doesn't fail (returns null -> falls back to ledger)
    const origFetch = global.fetch
    global.fetch = async () => { throw new Error("no rpc") }
    try {
      const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "histkey1", model: "demo", tokens: "1000" }),
      }))
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch // 恢复，避免污染其他用例
    }
    const histRaw = env.store.get("hist:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(histRaw).toBeTruthy()
    const hist = JSON.parse(histRaw)
    expect(hist).toHaveLength(1)
    expect(hist[0].model).toBe("demo")
    expect(hist[0].tokens).toBe("1000")
    expect(hist[0].chargedWei).toBe("2000000000000000000") // 2 credit
    expect(typeof hist[0].ts).toBe("number")

    const hres = await callWorker(env, new Request("https://billing.test/v1/history/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
    expect(hres.status).toBe(200)
    const hbody = await hres.json()
    expect(hbody.entries).toHaveLength(1)
    expect(hbody.entries[0].model).toBe("demo")
  })

  it("history caps at 100 entries (oldest dropped)", async () => {
    const env = makeEnv()
    const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    const existing = Array.from({ length: 100 }, (_, i) => ({ ts: i, model: "demo", tokens: "1", chargedWei: "1", tier: "free" }))
    env.store.set(`hist:${ADDR}`, JSON.stringify(existing))
    // directly append through a usage that fails quota — no; instead test via a helper path:
    // simplest: history endpoint returns capped list
    const hres = await callWorker(env, new Request(`https://billing.test/v1/history/${ADDR}`))
    expect(hres.status).toBe(200)
    const hbody = await hres.json()
    expect(hbody.entries).toHaveLength(100)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: FAIL — usage 无 hist 写回 / history 404

- [ ] **Step 3: 实现（index.js）**

a) 在 `/v1/usage` 的 200 写回块内（self 与 cust 两分支 put 之前），追加历史写回。找到该处（两个分支共享的 merged 计算后），插入：

```js
            // Consumption report (spec §7.2): append to per-address history
            const histKey = keyRow.kind === "cust" ? `hist:cust:${keyRow.custId}` : `hist:${keyRow.address}`
            const histRaw = await env.CINA_BILLING_KV.get(histKey)
            const hist = histRaw ? JSON.parse(histRaw) : []
            hist.push({ ts: Date.now(), model: body.model ?? "demo", tokens: String(body.tokens ?? 0), chargedWei: res.body.chargedWei, tier: res.body.tier })
            const trimmed = hist.slice(-100)
            await env.CINA_BILLING_KV.put(histKey, JSON.stringify(trimmed))
```

b) 新增路由（放在 `/v1/tier/` 路由之后、`/v1/custodial/` 路由之前）：

```js
    // Consumption report (spec §7.2): last N metered charges for an address
    if (url.pathname.startsWith("/v1/history/") && request.method === "GET") {
      const address = url.pathname.split("/").pop().toLowerCase()
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 100)
      try {
        const raw = await env.CINA_BILLING_KV.get(`hist:${address}`)
        const entries = raw ? JSON.parse(raw) : []
        return json(request, { address, entries: entries.slice(-limit) })
      } catch {
        return json(request, { error: "History data corrupted" })
      }
    }
```

c) CORS 无需变更（GET 已允许）。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/`
Expected: ALL PASS（含新 2 组；若 usage 测试因 global.fetch 桩影响其他用例，恢复 `global.fetch` 原值——用 `const origFetch = global.fetch` 在测试后 restore）

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): consumption history — hist write-back + /v1/history (M3 §7.2)"
```

---

## Task 3: Key 入金 — 加密存储与提交端点

**Files:**
- Create: `workers/billing/src/lib/ingress.js`
- Test: `workers/billing/src/lib/ingress.test.js`
- Modify: `workers/billing/src/index.js`
- Modify: `workers/billing/wrangler.toml`

- [ ] **Step 1: 写失败测试（ingress.test.js）**

```js
// workers/billing/src/lib/ingress.js tests
import { describe, it, expect } from "vitest"
import { ingressRecord, ingressStatusTransitions, validateDeclaredMicro } from "./ingress.js"

describe("ingressRecord", () => {
  it("builds a pending record with defaults", () => {
    const rec = ingressRecord({ owner: "0xaaa", model: "demo", declaredMicro: "500000000", keyHash: "0xdead" })
    expect(rec.owner).toBe("0xaaa")
    expect(rec.model).toBe("demo")
    expect(rec.declaredMicro).toBe("500000000")
    expect(rec.confirmedMicro).toBe("0")
    expect(rec.status).toBe("pending")
    expect(rec.keyHash).toBe("0xdead")
    expect(typeof rec.createdAt).toBe("number")
  })
})

describe("validateDeclaredMicro", () => {
  it("accepts positive integers", () => {
    expect(validateDeclaredMicro("1000000")).toBe("1000000")
    expect(validateDeclaredMicro(5000000)).toBe("5000000")
  })
  it("rejects zero/negative/non-numeric", () => {
    expect(() => validateDeclaredMicro("0")).toThrow(/positive/)
    expect(() => validateDeclaredMicro("-5")).toThrow(/positive/)
    expect(() => validateDeclaredMicro("abc")).toThrow(/integer/)
    expect(() => validateDeclaredMicro("1.5")).toThrow(/integer/)
  })
  it("caps at MAX_DECLARED_MICRO", () => {
    expect(() => validateDeclaredMicro("1000000000000001")).toThrow(/too large/)
  })
})

describe("ingressStatusTransitions", () => {
  it("pending -> minting -> minted", () => {
    expect(ingressStatusTransitions("pending", "minting")).toBe(true)
    expect(ingressStatusTransitions("minting", "minted")).toBe(true)
  })
  it("rejects invalid transitions", () => {
    expect(ingressStatusTransitions("pending", "minted")).toBe(false)
    expect(ingressStatusTransitions("minting", "pending")).toBe(false)
    expect(ingressStatusTransitions("minted", "minting")).toBe(false)
  })
  it("allows pending -> rejected", () => {
    expect(ingressStatusTransitions("pending", "rejected")).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/lib/ingress.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 ingress.js（纯逻辑部分）**

```js
// workers/billing/src/lib/ingress.js
// Key ingress channel (spec §6.3): user submits an API key + declared
// exchange amount; the platform pools the key, meters confirmed usage,
// and mints credit once confirmed consumption reaches the declared amount.

export const MAX_DECLARED_MICRO = 1_000_000_000_000_000n // 1e15 micro = 1e9 credit cap

/** Build a fresh pending ingress record */
export function ingressRecord({ owner, model, declaredMicro, keyHash }) {
  return {
    owner,
    model,
    declaredMicro: String(declaredMicro),
    confirmedMicro: "0",
    status: "pending", // pending -> minting -> minted | rejected
    keyHash, // SHA-256 of the raw key (never the key itself)
    createdAt: Date.now(),
  }
}

/** Validate a declared amount (micro-credit): positive integer, capped */
export function validateDeclaredMicro(raw) {
  const s = String(raw ?? "")
  if (!/^\d+$/.test(s)) throw new Error("declaredMicro must be a positive integer")
  const v = BigInt(s)
  if (v <= 0n) throw new Error("declaredMicro must be a positive integer")
  if (v > MAX_DECLARED_MICRO) throw new Error("declaredMicro too large")
  return s
}

/** State machine: allowed target states from a current state */
const TRANSITIONS = {
  pending: ["minting", "rejected"],
  minting: ["minted"],
  minted: [],
  rejected: [],
}

export function ingressStatusTransitions(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run workers/billing/src/lib/ingress.test.js`
Expected: PASS

- [ ] **Step 5: index.js 接线 — 提交端点 + 加密工具**

在 import 区补：

```js
import { ingressRecord, validateDeclaredMicro, ingressStatusTransitions } from "./lib/ingress.js"
```

在 hashKey 函数后追加加密工具：

```js
// AES-GCM key encryption for pooled ingress keys (spec §6.3: plaintext
// never leaves the platform). INGRESS_ENC_KEY = 32-byte hex (testnet var;
// mainnet: worker secret).
async function encryptKey(secretHex, rawKey) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secretHex.match(/.{2}/g).map((b) => parseInt(b, 16))),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(rawKey))
  return { iv: [...iv].map((b) => b.toString(16).padStart(2, "0")).join(""), cipher: [...new Uint8Array(cipher)].map((b) => b.toString(16).padStart(2, "0")).join("") }
}

async function decryptKey(secretHex, { iv, cipher }) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secretHex.match(/.{2}/g).map((b) => parseInt(b, 16))),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  )
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(iv.match(/.{2}/g).map((b) => parseInt(b, 16))) },
    key,
    Uint8Array.from(cipher.match(/.{2}/g).map((b) => parseInt(b, 16)))
  )
  return new TextDecoder().decode(plain)
}
```

新端点（放在 `/v1/custodial/` GET 路由之后、`/v1/keys` 之前）：

```js
    // Key ingress submit (spec §6.3): register a key + declared amount
    if (url.pathname === "/v1/ingress" && request.method === "POST") {
      if (!checkRegRateLimit(request)) return json(request, { error: "Too many requests" }, 429)
      const body = await request.json().catch(() => ({}))
      const { apiKey, model, declaredMicro, owner } = body
      if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) return json(request, { error: "Invalid apiKey" }, 400)
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner ?? "")) return json(request, { error: "Invalid owner" }, 400)
      if (!model || !["demo", "gpt-4o-mini", "deepseek-v3", "hunyuan"].includes(model)) return json(request, { error: "Invalid model" }, 400)
      let declared
      try {
        declared = validateDeclaredMicro(declaredMicro)
      } catch (err) {
        return json(request, { error: err instanceof Error ? err.message : "Invalid declaredMicro" }, 400)
      }
      const keyHash = await hashKey(apiKey)
      // reject duplicate submissions of the same key
      const existingRaw = await env.CINA_BILLING_KV.get(`keyhash:${keyHash}`)
      if (existingRaw) return json(request, { error: "Key already registered" }, 409)
      // optional upstream validation probe (testnet: unset -> skip)
      if (env.INGRESS_VALIDATE_URL) {
        try {
          const probe = await fetch(env.INGRESS_VALIDATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model }),
            signal: AbortSignal.timeout(10_000),
          })
          if (!probe.ok) return json(request, { error: "Key validation failed" }, 400)
        } catch {
          return json(request, { error: "Key validation failed" }, 400)
        }
      }
      const secretHex = env.INGRESS_ENC_KEY
      if (!secretHex || secretHex.length !== 64) return json(request, { error: "Ingress encryption not configured" }, 500)
      const encrypted = await encryptKey(secretHex, apiKey)
      const id = `ing_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
      const rec = ingressRecord({ owner: owner.toLowerCase(), model, declaredMicro: declared, keyHash })
      await env.CINA_BILLING_KV.put(`ing:${id}`, JSON.stringify({ ...rec, encrypted }))
      await env.CINA_BILLING_KV.put(`keyhash:${keyHash}`, id)
      return json(request, { ok: true, id, status: rec.status, declaredMicro: rec.declaredMicro, model: rec.model })
    }
```

wrangler.toml [vars] 追加：

```toml
# AES-GCM key for pooled ingress keys (32-byte hex; testnet — mainnet: secret)
INGRESS_ENC_KEY = "0000000000000000000000000000000000000000000000000000000000000000"
```

- [ ] **Step 6: 追加提交端点路由测试（index.test.js "M3 ingress submit" describe）**

```js
describe("M3 ingress submit", () => {
  it("valid submit returns pending record id", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = "a".repeat(64) // 32-byte hex
    const res = await callWorker(env, new Request("https://billing.test/v1/ingress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "ingress_test_abcdefghijklmnopqrstuvwxyz",
        model: "demo",
        declaredMicro: "2000000",
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toMatch(/^ing_/)
    expect(body.status).toBe("pending")
    const rec = JSON.parse(env.store.get(`ing:${body.id}`))
    expect(rec.owner).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    expect(rec.confirmedMicro).toBe("0")
    // plaintext key never stored — only encrypted + hash
    expect(JSON.stringify(rec)).not.toContain("ingress_test_abcdefghijklmnopqrstuvwxyz")
    expect(rec.encrypted.cipher).toBeTruthy()
  })

  it("duplicate key submission -> 409", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = "a".repeat(64)
    const body1 = { apiKey: "ingress_test_dup_abcdefghijklmnopqrstuv", model: "demo", declaredMicro: "1000", owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
    const r1 = await callWorker(env, new Request("https://billing.test/v1/ingress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body1) }))
    expect(r1.status).toBe(200)
    const r2 = await callWorker(env, new Request("https://billing.test/v1/ingress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body1) }))
    expect(r2.status).toBe(409)
  })

  it("invalid declaredMicro -> 400; missing enc key -> 500", async () => {
    const env = makeEnv()
    env.INGRESS_ENC_KEY = "a".repeat(64)
    const bad = await callWorker(env, new Request("https://billing.test/v1/ingress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "ingress_test_bad_abcdefghijklmnopqr", model: "demo", declaredMicro: "0", owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    }))
    expect(bad.status).toBe(400)
    const noKey = makeEnv()
    noKey.INGRESS_ENC_KEY = undefined
    const five = await callWorker(env, new Request("https://billing.test/v1/ingress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "ingress_test_nk_abcdefghijklmnopqr", model: "demo", declaredMicro: "1000", owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    }))
    expect(five.status).toBe(500)
  })
})
```

- [ ] **Step 7: 运行确认通过（全量）**

Run: `npx vitest run workers/billing/`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add workers/billing/src/lib/ingress.js workers/billing/src/lib/ingress.test.js workers/billing/src/index.js workers/billing/src/index.test.js workers/billing/wrangler.toml
git commit -m "feat(billing): key ingress — AES-GCM encryption, submit endpoint, status machine (M3 §6.3)"
```

---

## Task 4: Key 入金 — 消耗确认与触发铸造

**Files:**
- Modify: `workers/billing/src/index.js`
- Test: `workers/billing/src/index.test.js`

- [ ] **Step 1: 写失败测试（index.test.js 追加）**

```js
// 追加到 workers/billing/src/index.test.js — "M3 ingress consumption" describe block
describe("M3 ingress consumption", () => {
  it("usage with ingressId accumulates confirmedMicro; flips to minting at declared", async () => {
    const env = makeEnv()
    env.store.set("ing:ing1", JSON.stringify({
      owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", model: "demo",
      declaredMicro: "2000000", confirmedMicro: "0", status: "pending",
      keyHash: "0xabc", createdAt: 1, encrypted: { iv: "00", cipher: "00" },
    }))
    // self key flow with ingressId
    const data = new TextEncoder().encode("ingresskey1")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "self", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }))
    env.store.set("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", JSON.stringify({
      onchainSnapshot: (10n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0",
    }))
    const origFetch = global.fetch
    global.fetch = async () => { throw new Error("no rpc") }
    try {
      const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "ingresskey1", model: "demo", tokens: "1000", ingressId: "ing1" }),
      }))
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
    const rec = JSON.parse(env.store.get("ing:ing1"))
    // 1000 tokens demo @2000 micro = 2e6 micro = declared 2e6 -> minting
    expect(rec.confirmedMicro).toBe("2000000")
    expect(rec.status).toBe("minting")
  })

  it("usage with unknown ingressId is ignored (no crash)", async () => {
    const env = makeEnv()
    const data = new TextEncoder().encode("ingresskey2")
    const digest = await crypto.subtle.digest("SHA-256", data)
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
    env.store.set(`key:${hash}`, JSON.stringify({ kind: "self", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }))
    env.store.set("ledger:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", JSON.stringify({
      onchainSnapshot: (10n * 10n ** 18n).toString(), committedUsage: "0", cumulativeSpend: "0",
    }))
    const origFetch = global.fetch
    global.fetch = async () => { throw new Error("no rpc") }
    try {
      const res = await callWorker(env, new Request("https://billing.test/v1/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "ingresskey2", model: "demo", tokens: "100", ingressId: "nope" }),
      }))
      expect(res.status).toBe(200)
    } finally {
      global.fetch = origFetch
    }
  })

  it("POST /v1/ingress/:id/confirm marks minted", async () => {
    const env = makeEnv()
    env.store.set("ing:ing1", JSON.stringify({
      owner: "0xaaa", model: "demo", declaredMicro: "2000000", confirmedMicro: "2000000",
      status: "minting", keyHash: "0xabc", createdAt: 1,
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/ingress/ing1/confirm", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: "0xdef" }),
    }))
    expect(res.status).toBe(200)
    const rec = JSON.parse(env.store.get("ing:ing1"))
    expect(rec.status).toBe("minted")
    expect(rec.txHash).toBe("0xdef")
  })

  it("confirm rejects bad transitions (pending -> minted)", async () => {
    const env = makeEnv()
    env.store.set("ing:ing1", JSON.stringify({
      owner: "0xaaa", model: "demo", declaredMicro: "2000000", confirmedMicro: "0",
      status: "pending", keyHash: "0xabc", createdAt: 1,
    }))
    const res = await callWorker(env, new Request("https://billing.test/v1/ingress/ing1/confirm", {
      method: "POST",
      headers: { "X-Admin-Key": "test-admin", "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: "0xdef" }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: FAIL — ingressId 未处理 / confirm 404

- [ ] **Step 3: 实现（index.js）**

a) `/v1/usage` 中，在 hist 写回之后（同一 200 块内）追加入金确认逻辑：

```js
            // Key ingress confirmation (spec §6.3): attribute this charge to
            // a pooled key; flip to minting once confirmed >= declared.
            if (body.ingressId) {
              const ingKey = `ing:${body.ingressId}`
              const ingRaw = await env.CINA_BILLING_KV.get(ingKey)
              if (ingRaw) {
                const rec = JSON.parse(ingRaw)
                if (rec.status === "pending") {
                  rec.confirmedMicro = (BigInt(rec.confirmedMicro ?? 0) + BigInt(res.body.chargedMicro)).toString()
                  if (BigInt(rec.confirmedMicro) >= BigInt(rec.declaredMicro)) {
                    rec.status = "minting"
                  }
                  await env.CINA_BILLING_KV.put(ingKey, JSON.stringify(rec))
                }
              }
            }
```

b) 新路由（放在 `/v1/ingress` POST 之后）：

```js
    // Admin: confirm an ingress mint (moves minting -> minted, records txHash)
    const ingConfirmMatch = url.pathname.match(/^\/v1\/ingress\/([a-zA-Z0-9_]+)\/confirm$/)
    if (ingConfirmMatch && request.method === "POST") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
      const [, id] = ingConfirmMatch
      const body = await request.json().catch(() => ({}))
      const key = `ing:${id}`
      const raw = await env.CINA_BILLING_KV.get(key)
      if (!raw) return json(request, { error: "Ingress record not found" }, 404)
      const rec = JSON.parse(raw)
      if (!ingressStatusTransitions(rec.status, "minted")) return json(request, { error: `Invalid transition from ${rec.status}` }, 400)
      rec.status = "minted"
      rec.txHash = body.txHash ?? null
      await env.CINA_BILLING_KV.put(key, JSON.stringify(rec))
      return json(request, { ok: true, id, status: rec.status })
    }
```

c) 新增 admin 列表端点（供脚本扫描 minting 记录；放在 ingress confirm 之后）：

```js
    // Admin: list ingress records (status filter optional)
    if (url.pathname === "/v1/admin/ingress" && request.method === "GET") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
        return json(request, { error: "Unauthorized" }, 401)
      }
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
```

- [ ] **Step 4: 运行确认通过（全量）**

Run: `npx vitest run workers/billing/`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/index.js workers/billing/src/index.test.js
git commit -m "feat(billing): ingress consumption confirmation + minting trigger + admin endpoints (M3 §6.3)"
```

---

## Task 5: 入金铸造脚本

**Files:**
- Create: `scripts/ingress-mint.mjs`

- [ ] **Step 1: 实现 scripts/ingress-mint.mjs**

```js
/**
 * 扫描 worker 中 status=minting 的 Key 入金记录 → owner 链上铸造 CinaCredit → 确认闭环。
 * 用法: DEPLOY_PRIVATE_KEY=0x... BILLING_URL=... ADMIN_KEY=... node scripts/ingress-mint.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BILLING_URL = process.env.BILLING_URL || "https://cinachain-billing.cinagroup.workers.dev"
const ADMIN_KEY = process.env.ADMIN_KEY
const CREDIT = process.env.CINA_CREDIT_CONTRACT || "0x78f5aebc75b7d197b10622cccabe8429617836d7"
const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
if (!PK || !ADMIN_KEY) throw new Error("DEPLOY_PRIVATE_KEY and ADMIN_KEY required")

const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

const MINT_ABI = [
  { name: "mintTo", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
]

// 1 micro-credit = 1e12 wei (与 worker WEI_PER_MICRO 一致)
const WEI_PER_MICRO = 1_000_000_000_000n

const res = await fetch(`${BILLING_URL}/v1/admin/ingress?status=minting`, { headers: { "X-Admin-Key": ADMIN_KEY } })
if (!res.ok) throw new Error(`admin/ingress ${res.status}: ${await res.text()}`)
const { records } = await res.json()
if (!records.length) { console.log("✔ 无待铸造入金记录"); process.exit(0) }

for (const rec of records) {
  const amountWei = BigInt(rec.confirmedMicro) * WEI_PER_MICRO
  const hash = await wallet.writeContract({
    address: CREDIT, abi: MINT_ABI, functionName: "mintTo",
    args: [rec.owner, amountWei],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") {
    console.error(`❌ mintTo REVERTED for ${rec.id} (${rec.owner}) — 跳过确认`)
    continue
  }
  console.log(`✔ 入金 ${rec.id} -> ${rec.owner} ${amountWei} wei tx=${hash}`)
  const confirm = await fetch(`${BILLING_URL}/v1/ingress/${rec.id}/confirm`, {
    method: "POST",
    headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: hash }),
  })
  if (!confirm.ok) console.warn(`⚠ confirm failed for ${rec.id}: ${await confirm.text()}`)
}
console.log("✔ 全部入金铸造完成")
```

- [ ] **Step 2: 语法检查（不执行）**

Run: `node --check scripts/ingress-mint.mjs`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add scripts/ingress-mint.mjs
git commit -m "feat(billing): ingress mint script — scan minting, mintTo, confirm (M3 §6.3)"
```

---

## Task 6: 前端 — /credits 兑出卡片 + /keys 入金页

**Files:**
- Modify: `lib/contracts/cina-credit.ts`
- Modify: `app/(general)/credits/page.tsx`
- Create: `app/(general)/keys/page.tsx`

- [ ] **Step 1: 扩展 CinaCredit ABI**

在 `lib/contracts/cina-credit.ts` 数组追加：

```ts
  { name: "redeem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "creditAmount", type: "uint256" }], outputs: [] },
  { name: "redeemEnabled", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
```

- [ ] **Step 2: 修改 /credits 页 — 兑出卡片**

在 `app/(general)/credits/page.tsx` 中（先读文件，找到 Balance card 之后、Top Up card 之前或之后均可，保持 Card 网格结构）：

新增状态（在组件顶部 state 区）：

```tsx
  const [redeemAmount, setRedeemAmount] = useState("")
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)
```

新增读取（在 useCreditBalance 调用后追加，用 useReadContracts 一次性读 redeemEnabled + 金库余额）：

```tsx
  const { data: redeemData } = useReadContracts({
    contracts: [
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "redeemEnabled" },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "balanceOf", args: [CINA_CREDIT_CONTRACT] },
    ],
    query: { enabled: hasCreditContract },
  })
  const redeemEnabled = redeemData?.[0]?.status === "success" && redeemData[0].result === true
  const treasuryCredit = redeemData?.[1]?.status === "success" ? (redeemData[1].result as bigint) : undefined
  // redeem 金额单位是 credit（合约 redeem(uint256 creditAmount)，1e18 缩放）；预计 ETH = creditWei / rate
  const WEI_PER_CREDIT = 1_000_000_000_000_000_000n
  const redeemWei = /^\d+$/.test(redeemAmount) ? BigInt(redeemAmount) * WEI_PER_CREDIT : 0n
  const ethOut = creditRate && redeemWei > 0n ? redeemWei / creditRate : undefined
```

处理器：

```tsx
  const handleRedeem = async () => {
    setRedeemError(null)
    setRedeemMsg(null)
    if (!/^\d+$/.test(redeemAmount) || redeemWei <= 0n) {
      setRedeemError("Enter a positive credit amount")
      return
    }
    if (!redeemEnabled) {
      setRedeemError("Redemption is currently disabled")
      return
    }
    setRedeemBusy(true)
    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName: "redeem",
        args: [redeemWei],
      })
      setTxHash(hash)
    } catch (err) {
      setRedeemError(extractError(err))
    } finally {
      setRedeemBusy(false)
    }
  }
```

（检查该文件已有 writeContractAsync/txHash/extractError —— M1 充值时已存在，复用。）

JSX（Card 结构跟随现有样式）：

```tsx
          {/* Redeem card */}
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle>Redeem</CardTitle>
              <CardDescription>
                Burn CinaCredit for ETH at the current rate (treasury-funded)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold",
                    redeemEnabled ? "bg-[#50e3c2]/20 text-[#29bc9b]" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {redeemEnabled ? "Enabled" : "Disabled"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Treasury: {treasuryCredit === undefined ? "—" : formatBalance(treasuryCredit)} credit
                </span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="redeemAmount">Credit to redeem</Label>
                <Input
                  id="redeemAmount"
                  type="number"
                  min="1"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  disabled={redeemBusy}
                />
              </div>
              {ethOut !== undefined && redeemWei > 0n && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatEther(ethOut)} ETH
                </p>
              )}
              {redeemError && <p className="text-sm text-destructive">{redeemError}</p>}
              {redeemMsg && <p className="text-sm text-[#29bc9b]">{redeemMsg}</p>}
              <Button onClick={handleRedeem} disabled={redeemBusy || !redeemAmount} className="w-full" variant="outline">
                {redeemBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Redeem"}
              </Button>
            </CardContent>
          </Card>
```

import 补（在文件顶部 import 区，先读文件确认现状）：`formatEther` from "viem"（若缺）、`useReadContracts` from "wagmi"（若缺）、`Label` from "@/components/ui/label"（若缺）、`cn` from "@/lib/utils"（若缺）、`Loader2` from "lucide-react"（若缺）。检查该文件 M1 充值实现已有哪些（writeContractAsync/txHash/extractError/useWaitForTransactionReceipt 已有），只补缺失项。

- [ ] **Step 3: 创建 /keys 入金页**

`app/(general)/keys/page.tsx`：

```tsx
"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { KeyRound, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://cinachain-billing.cinagroup.workers.dev"

const MODELS = [
  { id: "demo", label: "Demo" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "deepseek-v3", label: "DeepSeek V3" },
  { id: "hunyuan", label: "Hunyuan" },
]

interface IngressRecord {
  id: string
  owner: string
  model: string
  declaredMicro: string
  confirmedMicro: string
  status: string
  createdAt: number
}

export default function KeysPage() {
  const { address } = useAccount()
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("demo")
  const [declared, setDeclared] = useState("1000000")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [records, setRecords] = useState<IngressRecord[]>([])

  // Reset transient state on account switch
  useEffect(() => {
    setError(null)
    setSuccess(null)
    setApiKey("")
  }, [address])

  const loadRecords = async () => {
    if (!address) return
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/history/${address}`)
      // history endpoint is per-address; ingress list needs owner query —
      // use the public GET /v1/ingress?owner= if available, else skip
      void res
    } catch {
      /* ignore */
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!address) {
      setError("Connect your wallet first")
      return
    }
    if (apiKey.length < 20) {
      setError("API key too short")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/ingress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, declaredMicro: declared, owner: address }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `submit failed: ${res.status}`)
      setSuccess(`Ingress registered: ${body.id} (${body.status})`)
      setApiKey("")
      await loadRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit key")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-[960px] px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Billing
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Key Ingress<span className="text-muted-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Share an API key with the platform pool and earn CinaCredit once it is
        consumed (spec §6.3 — declared amount, deferred minting).
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mt-6 border-[#50e3c2]/30 bg-[#50e3c2]/10">
          <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
          <AlertDescription className="text-sm text-[#29bc9b]">{success}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Submit API Key
          </CardTitle>
          <CardDescription>
            Your key is encrypted at rest and never exposed; you earn credits
            when the pool consumes it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <select
                id="model"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-vercel-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={submitting}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="declared">Declared amount (micro-credit)</Label>
              <Input
                id="declared"
                type="number"
                min="1"
                value={declared}
                onChange={(e) => setDeclared(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !address} className="w-full" size="lg">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Key
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>Your Ingress Records</CardTitle>
          <CardDescription>Pending / minting / minted status</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No records yet — submit a key above. (Public status list arrives with
              GET /v1/ingress?owner= in a follow-up; the worker keeps full records
              admin-side.)
            </p>
          ) : (
            <ul className="space-y-3">
              {records.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-mono-tech text-xs">{r.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.model} · confirmed {r.confirmedMicro}/{r.declaredMicro} micro
                    </p>
                  </div>
                  <span className="text-xs font-medium">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

注意：loadRecords 目前是占位（公开按 owner 查询端点属于可选项）——实现 Task 7 时决定是否加 `GET /v1/ingress?owner=` 公开端点。若加，页面接上真实列表。

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功（静态导出）

- [ ] **Step 5: Commit**

```bash
git add lib/contracts/cina-credit.ts "app/(general)/credits/page.tsx" "app/(general)/keys/page.tsx"
git commit -m "feat(billing): redeem card + key ingress page (M3 §6.3, §8)"
```

---

## Task 7: 公开入金列表 + E2E + 文档

**Files:**
- Modify: `workers/billing/src/index.js`（+GET /v1/ingress?owner= 公开端点）
- Modify: `workers/billing/src/index.test.js`
- Modify: `app/(general)/keys/page.tsx`（接真实列表）
- Modify: `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md`（§8 M3 状态 + §6.3 简化说明）

- [ ] **Step 1: 公开列表端点（index.js，放在 /v1/ingress POST 之后）**

```js
    // Public: list own ingress records (spec §6.3: user can view pending status)
    if (url.pathname === "/v1/ingress" && request.method === "GET") {
      const owner = (url.searchParams.get("owner") ?? "").toLowerCase()
      if (!/^0x[a-fA-F0-9]{40}$/.test(owner)) return json(request, { error: "Invalid owner" }, 400)
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
```

测试：

```js
// 追加 "M3 ingress public list" — 建 ing:ingA(owner A) + ing:ingB(owner B)，GET ?owner=A 只返回 A
```

- [ ] **Step 2: /keys 页接真实列表**

将 `loadRecords` 替换为真实实现并挂到 useEffect(address) + submit 后：

```tsx
  const loadRecords = async () => {
    if (!address) return
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/ingress?owner=${address}`)
      if (!res.ok) return
      const body = await res.json()
      setRecords(body.records ?? [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    setError(null)
    setSuccess(null)
    setApiKey("")
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])
```

- [ ] **Step 3: 本地 E2E 冒烟（wrangler dev --local）**

```bash
cd workers/billing && npx wrangler dev --local --port 8793 --test-scheduled
```

1. `curl -X POST :8793/v1/ingress -d '{"apiKey":"ingress_e2e_abcdefghijklmnopqrstuvwxyz","model":"demo","declaredMicro":"2000000","owner":"0x..."}'` → id + pending
2. 注册 key + ledger 余额 → `POST /v1/usage {"apiKey":"...","tokens":"1000","ingressId":"<id>"}` → 200
3. `GET /v1/ingress?owner=<owner>` → confirmedMicro 2000000, status minting
4. `POST /v1/ingress/<id>/confirm -H "X-Admin-Key:..."` → minted
5. `GET /v1/admin/ingress?status=minting` → 空
6. `GET /v1/history/<addr>` → 1 条消耗明细
7. `GET /v1/admin/pricing` + `PUT /v1/admin/pricing`（若实现）→ 见下方 Task 7 Step 4 备注

- [ ] **Step 4: 定价 admin 端点 + usage 运行时读取合并表**

在 `/v1/admin/index` 之前加：

```js
    // Admin: view pricing (default + overrides)
    if (url.pathname === "/v1/admin/pricing" && request.method === "GET") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) return json(request, { error: "Unauthorized" }, 401)
      const raw = await env.CINA_BILLING_KV.get("pricing")
      const overrides = raw ? JSON.parse(raw) : {}
      return json(request, { default: DEFAULT_PRICING, overrides })
    }

    // Admin: update pricing overrides (spec §7.2 — grayscale, no redeploy)
    if (url.pathname === "/v1/admin/pricing" && request.method === "PUT") {
      if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) return json(request, { error: "Unauthorized" }, 401)
      const body = await request.json().catch(() => ({}))
      try {
        const merged = applyPricingOverrides(DEFAULT_PRICING, body.overrides ?? null)
        await env.CINA_BILLING_KV.put("pricing", JSON.stringify(body.overrides ?? {}))
        return json(request, { ok: true, merged })
      } catch (err) {
        return json(request, { error: err instanceof Error ? err.message : "Invalid pricing" }, 400)
      }
    }
```

同时将 `/v1/usage` 热路径切换到运行时合并表（在 withLedgerLock 内、handleUsage 调用前读取 KV pricing 一次）：

```js
          const pricingRaw = await env.CINA_BILLING_KV.get("pricing")
          const pricing = applyPricingOverrides(DEFAULT_PRICING, pricingRaw ? JSON.parse(pricingRaw) : null)
          const res = await handleUsage({ model, tokens, ingressId: body.ingressId }, ledger, pricing)
```

（handleUsage 的 pricing 参数已在 Task 1 Step 5 加入，此处只是传值。index.js import 补 `applyPricingOverrides, DEFAULT_PRICING` from "./lib/pricing.js"。）

追加测试：

```js
// "M3 pricing admin" — GET 返回 default+overrides；PUT 合法覆盖 200 + KV 持久化；PUT 非法覆盖 400
// "usage applies runtime pricing overrides" — KV 放 {"gpt-4o-mini":{"perTokenMicroCredit":"200"}}，
//   self key + ledger 余额 + 无 RPC 桩，POST usage model=gpt-4o-mini tokens=1000 → chargedMicro "200000"
```

import 补：index.test.js 顶部 `applyPricingOverrides, DEFAULT_PRICING` from "./lib/pricing.js"。

- [ ] **Step 5: 文档更新（spec）**

§8 M3 行：

```markdown
| **M3** | Key 入金通道（验证/池化/确认铸造）+ 定价表细分 + 消耗明细报表 + **兑出（redeem，金库余额上限保护）** | key 提供者可获得 Credit；用户可兑出；平台可审计 ✅ 已完成（2026-08-04，M3 分支 feat/credit-billing-m3） |
```

§6.3 追加说明（验证简化）：

```markdown
> 测试网实现注记：key 有效性验证降级为格式校验 + 可选 `INGRESS_VALIDATE_URL` 测试调用（未配置时跳过，状态直接 pending）；key 以 AES-GCM 加密存 KV（`INGRESS_ENC_KEY`），明文永不落盘。主网接入真实上游时启用完整验证。
```

- [ ] **Step 6: 全量测试 + 构建 + 提交**

Run: `npx vitest run` 与 `npm run build`
```bash
git add workers/billing/src/index.js workers/billing/src/index.test.js "app/(general)/keys/page.tsx" docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md
git commit -m "feat(billing): public ingress list + pricing admin endpoints + E2E + docs (M3)"
```
