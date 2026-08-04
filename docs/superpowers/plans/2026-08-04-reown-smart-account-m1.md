# Reown Smart Account 双钱包支持 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将钱包连接层从 RainbowKit 迁移到 Reown AppKit，新增 email/social 登录 → ERC-4337 Smart Account，与外部 EOA（injected/WalletConnect/Coinbase）在同一实例并存；升级 SIWE 支持 EIP-1271/6492 签名；双 paymaster（Pimlico + CDP proxy）。业务代码（useAccount/useWriteContract 等 wagmi hooks）零改动。

**Architecture:** 四阶段 — S1 依赖替换 + AppKit provider + 连接按钮迁移（EOA 全回归）；S2 email/social 登录 → SA 创建 → 首笔交易部署 → 充值/铸造端到端；S3 SIWE 1271/6492 验证升级 + paymaster 账户类型分支；S4 浏览器 E2E 全回归 + 生产部署。

**Tech Stack:** `@reown/appkit` + `@reown/appkit-adapter-wagmi`（替换 RainbowKit）、wagmi 2.14（不变）、viem `verifyMessage`（1271/6492）、Pimlico paymaster、现有 CDP paymaster proxy worker。

---

## 计划偏差记录（相对 spec）

| spec 假设 | 实际 | 处理 |
|---|---|---|
| `components/shared/wallet-connect.tsx` | 实际组件在 `components/blockchain/wallet-connect.tsx`（shared 下无此文件） | 按实际路径修改 |
| AppKit 按钮组件名 | `AppKitButton` 需以实际安装版本为准（v1 为 `AppKitButton`，v2 可能有变化） | Task 1 实施时按安装版本适配 |
| `@reown/appkit/networks` 导出 | 需确认 baseSepolia 存在（Base 官方文档确认 Reown 支持 Base） | Task 1 实施时验证 |

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `package.json` | +`@reown/appkit`、`@reown/appkit-adapter-wagmi`；−`@rainbow-me/rainbowkit` | 修改 |
| `components/providers/rainbow-kit.tsx` | 重写为 AppKit provider（`appkit-provider.tsx`） | 重写+改名 |
| `components/providers/root-provider.tsx` | 引用新 provider | 修改 |
| `components/blockchain/wallet-connect.tsx` | 连接按钮迁移 | 修改 |
| `lib/hooks/use-siwe.ts` | 签名验证升级（verifyMessage） | 修改 |
| `lib/hooks/use-paymaster.ts` | 账户类型分支（sa/coinbase/eoa） | 修改 |
| `lib/hooks/use-account-type.ts` | 账户类型判定 hook（新） | 新建 |
| `.env.local` / `.env.production` | +`NEXT_PUBLIC_REOWN_PROJECT_ID`、`NEXT_PUBLIC_PIMLICO_API_KEY` | 修改 |
| `docs/superpowers/specs/2026-08-04-reown-smart-account-design.md` | §8 S1-S4 状态标记 | 修改 |

---

## Task 1 (S1): 依赖替换 + AppKit Provider + 连接按钮迁移

**Files:**
- Modify: `package.json`
- Create: `components/providers/appkit-provider.tsx`
- Modify: `components/providers/root-provider.tsx`
- Modify: `components/blockchain/wallet-connect.tsx`
- Modify: `.env.local` / `.env.production`

- [ ] **Step 1: 安装依赖并移除 RainbowKit**

```bash
npm install @reown/appkit @reown/appkit-adapter-wagmi --legacy-peer-deps
npm uninstall @rainbow-me/rainbowkit @rainbow-me/rainbowkit-core 2>/dev/null || true
```

注意：若 `npm uninstall` 失败（依赖被其他包引用），则仅移除直接依赖声明并保留 node_modules 中残留 —— 以 `npm ls @rainbow-me/rainbowkit` 输出为准，确认业务代码不再 import 它即可。

- [ ] **Step 2: 验证安装版本与 API**

Run: `node -e "const a=require('@reown/appkit/package.json'); console.log('appkit', a.version); const w=require('@reown/appkit-adapter-wagmi/package.json'); console.log('adapter', w.version);"`

检查 `@reown/appkit/networks` 是否有 `baseSepolia` 导出：

```bash
node -e "const n=require('@reown/appkit/networks'); console.log('baseSepolia' in n ? 'OK' : Object.keys(n).slice(0,20))"
```

若版本为 v2.x，按 v2 API 调整（`createAppKit` 签名可能变化）；若为 v1.x 按下方代码。

- [ ] **Step 3: 创建 appkit-provider.tsx**

```tsx
"use client"

import "@reown/appkit/styles.css"

import { useMemo, type ReactNode } from "react"
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { baseSepolia } from "@reown/appkit/networks"
import { createStorage, noopStorage } from "@wagmi/core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

import { chains, transports } from "@/config/networks"
import { siteConfig } from "@/config/site"
import { useColorMode } from "@/lib/state/color-mode"

const PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID &&
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID !== "placeholder"
    ? process.env.NEXT_PUBLIC_REOWN_PROJECT_ID
    : ""

if (!PROJECT_ID && process.env.NODE_ENV === "development") {
  console.warn(
    "[cinachain] NEXT_PUBLIC_REOWN_PROJECT_ID is not set. WalletConnect (mobile wallets) and Reown smart accounts will not work."
  )
}

// Reown AppKit — single wallet provider. External EOAs (injected browser
// wallets, WalletConnect, Coinbase) work out of the box; email/social
// login enables ERC-4337 smart accounts (spec: reown-smart-account-design).
export const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: [baseSepolia],
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
})

createAppKit({
  adapters: [wagmiAdapter],
  projectId: PROJECT_ID,
  networks: [baseSepolia],
  features: {
    email: true,
    socials: ["google", "x", "github"],
  },
  metadata: {
    name: siteConfig.title,
    description: siteConfig.description,
    url: typeof window !== "undefined" ? window.location.href : "",
    icons: [],
  },
})

export function AppKitProvider({ children }: { children: ReactNode }) {
  const [colorMode] = useColorMode()
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
      }),
    []
  )

  // themeMode is read from AppKit's internal state at open time; we set
  // the initial mode from the app's color mode.
  if (colorMode) {
    try {
      // @ts-expect-error — AppKit exposes setThemeMode for runtime updates
      window.AppKit?.setThemeMode?.(colorMode === "dark" ? "dark" : "light")
    } catch {
      /* ignore */
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiAdapter.wagmiConfig as never} reconnectOnMount>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
```

注意：
- `WagmiProvider` 需要 wagmi config —— `wagmiAdapter.wagmiConfig` 即为配置对象（若类型不匹配用 `as never`，实施时以实际 TS 类型为准调整）
- 若 v2 版本 API 不同（如 `createAppKit` 参数变化），按实际安装版本的官方示例调整 —— 以 `node_modules/@reown/appkit/README.md` 或包内 types 为准
- `chains`/`transports` 来自 `@/config/networks` 目前可能不再需要（AppKit networks 自带 transport）；若 TS 报未使用变量，删除该 import。wagmiAdapter 是否接受自定义 transports：v1 接受 `networks`（含 transport），若需自定义 RPC fallback 用 `networks: [{...baseSepolia, rpcUrls}]` 形式 —— 实施时确认

- [ ] **Step 4: 更新 root-provider.tsx**

将 `import { RainbowKit } from "@/components/providers/rainbow-kit"` 改为 `import { AppKitProvider } from "@/components/providers/appkit-provider"`，JSX 中 `<RainbowKit>` → `<AppKitProvider>`（其余不变）。

- [ ] **Step 5: 更新 wallet-connect.tsx**

```tsx
import { HtmlHTMLAttributes } from "react"
// Reown AppKit connect button — supports EOA connectors and smart accounts
import { AppKitButton } from "@reown/appkit/react"

export const WalletConnect = ({
  className,
  ...props
}: HtmlHTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={className} {...props}>
      <AppKitButton balance="hide" />
    </span>
  )
}
```

注意：若安装版本无 `AppKitButton`（v2 改名），改用 `<appkit-button>` web component 或 AppKit 的 `useAppKit()` + 自绘按钮。实施时按版本适配；确认按钮样式与现有右下角悬浮布局兼容（`balance="hide"` 保持紧凑）。

- [ ] **Step 6: 更新 .env 文件**

`.env.local` 与 `.env.production` 追加：

```bash
NEXT_PUBLIC_REOWN_PROJECT_ID=<现有 WC project id 或新建>
NEXT_PUBLIC_PIMLICO_API_KEY=<可选，SA gasless；未配置则 SA 自付 gas>
```

（值由用户提供；若暂时无 key，先用占位并让 SA 走自付 gas 路径验证。）

- [ ] **Step 7: 全仓清理 RainbowKit 残留**

```bash
grep -rn "rainbowkit\|RainbowKit\|ConnectButton" app/ components/ lib/ --include="*.tsx" --include="*.ts"
```

清理所有残留 import（重点：`components/blockchain/wallet-connect.tsx`、任何 demo 页面）。`app/(general)/integration/*` 页面若引用 RainbowKit 组件，一并替换为 AppKit 等价物或 wagmi 自绘按钮。

- [ ] **Step 8: 构建验证 + EOA 回归**

Run: `npm run build` — 必须通过（静态导出 530+ 页，无 indexedDB prerender 崩溃）。

浏览器验证（web-gui-tester，若可用）：连接 MetaMask（或 injected 模拟）→ 首页/充值页正常 → 断连正常。

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json components/ .env.local .env.production
git commit -m "feat(wallet): migrate RainbowKit -> Reown AppKit (S1 — EOA coexists with smart accounts)"
```

---

## Task 2 (S1): SIWE 签名验证升级（EIP-1271/6492）

**Files:**
- Modify: `lib/hooks/use-siwe.ts`
- Test: `lib/hooks/use-siwe.test.ts`（新，若项目有 hook 测试惯例则加；否则纯函数抽取）

- [ ] **Step 1: 抽取可测试的验证纯函数**

在 `lib/hooks/use-siwe.ts` 顶部新增（或新建 `lib/siwe-verify.ts`）：

```ts
// lib/siwe-verify.ts
import { verifyMessage, type PublicClient } from "viem"

/**
 * Verify a SIWE message signature. Supports EOA (direct), EIP-1271
 * (deployed smart accounts) and EIP-6492 (counterfactual smart accounts)
 * via viem's verifyMessage — Reown smart accounts emit 1271/6492.
 */
export async function verifySiweSignature(
  publicClient: PublicClient,
  {
    address,
    message,
    signature,
  }: { address: `0x${string}`; message: string; signature: `0x${string}` }
): Promise<boolean> {
  try {
    return await verifyMessage(publicClient, {
      address,
      message,
      signature,
    })
  } catch {
    return false
  }
}
```

- [ ] **Step 2: use-siwe.ts 使用验证函数**

在 `useSiwe` 中（签名完成后），将"仅存 session"扩展为"验证通过才存 session"：

```tsx
  const { data: publicClient } = usePublicClient()

  // ...现有 signMessageAsync 调用得到 signature 后：
  const message = createSiweMessage({ address, chainId, nonce })
  const signature = await signMessageAsync({ message })
  if (publicClient) {
    const ok = await verifySiweSignature(publicClient, {
      address: address as `0x${string}`,
      message,
      signature,
    })
    if (!ok) throw new Error("Signature verification failed")
  }
  // 验证通过后存 session（现有逻辑）
```

注意：
- `createSiweMessage` 为现有函数（读文件确认其实现与位置）
- `usePublicClient` 从 wagmi import
- SA 用户签名时 wagmi 自动路由到 SA 的 1271/6492 签名 —— 前端签名调用不变

- [ ] **Step 3: 测试**

若项目有 hook 测试惯例（检查 `lib/__tests__/`），为 `verifySiweSignature` 添加测试（mock viem verifyMessage 成功/失败路径）；否则说明性跳过并在报告中记录。

- [ ] **Step 4: 构建验证**

Run: `npm run build` — 通过。

- [ ] **Step 5: Commit**

```bash
git add lib/ docs/superpowers/specs/2026-08-04-reown-smart-account-design.md
git commit -m "feat(wallet): SIWE verification via viem verifyMessage (EIP-1271/6492 for smart accounts)"
```

---

## Task 3 (S2): 账户类型判定 + 双 Paymaster 分支

**Files:**
- Create: `lib/hooks/use-account-type.ts`
- Modify: `lib/hooks/use-paymaster.ts`
- Modify: `components/blockchain/wallet-connect.tsx`（可选：显示账户类型标签）

- [ ] **Step 1: 创建 use-account-type.ts**

```ts
"use client"

import { useMemo } from "react"
import { useAccount } from "wagmi"
import { useCapabilities } from "wagmi/experimental"

export type AccountType = "sa" | "coinbase-smart-wallet" | "eoa"

/**
 * Classify the connected account for gas/paymaster routing.
 * - "sa": Reown embedded-wallet smart account (ERC-4337)
 * - "coinbase-smart-wallet": Coinbase Smart Wallet (EIP-5792 paymaster)
 * - "eoa": plain externally-owned account
 */
export function useAccountType(): {
  accountType: AccountType | null
  isSmartAccount: boolean
} {
  const { address, chainId } = useAccount()
  const { data: available } = useCapabilities({ account: address })

  return useMemo(() => {
    if (!address) return { accountType: null, isSmartAccount: false }
    const chainCaps = available?.[chainId ?? 0]
    if (chainCaps?.paymasterService?.supported) {
      return { accountType: "coinbase-smart-wallet", isSmartAccount: true }
    }
    // Reown embedded wallet detection — AppKit v1 exposes the embedded
    // wallet via the modal state; check localStorage marker AppKit writes
    // for email/social sessions, or rely on capabilities absence + a
    // dedicated detection below.
    const embeddedMarker = typeof window !== "undefined"
      ? window.localStorage.getItem("@appkit/embedded-wallet") ??
        window.localStorage.getItem("w3m-embedded-wallet")
      : null
    if (embeddedMarker) {
      return { accountType: "sa", isSmartAccount: true }
    }
    return { accountType: "eoa", isSmartAccount: false }
  }, [address, chainId, available])
}
```

注意：Reown SA 的可靠检测方式以实施时实际版本为准 —— AppKit 会在 localStorage 写入内嵌钱包会话标记（键名可能变化）；若 v2 提供 `useAppKitAccount()`/`useAppKitState()` 官方 hook 返回 `embeddedWalletInfo.accountType`，优先用官方 API（实施时查 `@reown/appkit/react` 的导出并调整）。

- [ ] **Step 2: use-paymaster.ts 增加 SA 分支**

```ts
"use client"

import { useMemo } from "react"
import { useAccount } from "wagmi"
import { useCapabilities } from "wagmi/experimental"
import { useAccountType } from "./use-account-type"

/**
 * Returns paymaster routing for the connected account:
 * - Reown smart account ("sa"): AppKit handles UserOp + Pimlico internally;
 *   returns a marker so callers skip manual capabilities.
 * - Coinbase Smart Wallet ("coinbase-smart-wallet"): EIP-5792 paymaster
 *   capabilities (CDP proxy).
 * - EOA: empty capabilities — user pays gas normally.
 */
export function usePaymasterCapabilities() {
  const { address, chainId } = useAccount()
  const { accountType } = useAccountType()
  const { data: available } = useCapabilities({ account: address })

  const paymasterProxyUrl = process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL

  const { capabilities, isPaymasterSupported, viaSmartAccount } = useMemo(() => {
    if (accountType === "sa") {
      // AppKit's smart-account flow handles paymaster sponsorship
      // internally; no manual capabilities needed.
      return { capabilities: {}, isPaymasterSupported: true, viaSmartAccount: true }
    }
    if (!available || !chainId || !paymasterProxyUrl) {
      return { capabilities: {}, isPaymasterSupported: false, viaSmartAccount: false }
    }
    const chainCaps = available[chainId]
    if (chainCaps?.paymasterService?.supported) {
      return {
        capabilities: {
          paymasterService: { url: paymasterProxyUrl },
        },
        isPaymasterSupported: true,
        viaSmartAccount: false,
      }
    }
    return { capabilities: {}, isPaymasterSupported: false, viaSmartAccount: false }
  }, [accountType, available, chainId, paymasterProxyUrl])

  return { capabilities, isPaymasterSupported, viaSmartAccount }
}
```

- [ ] **Step 3: 消费方适配**

grep `usePaymasterCapabilities` 消费方（`lib/hooks/use-mint-contract.ts` 等），确认返回结构变化（新增 `viaSmartAccount` 字段）不破坏现有调用；SA 用户的交易走 AppKit 内建 UserOp 流程（若消费方需要显式调用，在实施时按 AppKit API 适配 —— 优先验证 AppKit 对 wagmi `writeContract` 的透明代理）。

- [ ] **Step 4: 构建验证**

Run: `npm run build` — 通过。

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-account-type.ts lib/hooks/use-paymaster.ts
git commit -m "feat(wallet): account-type detection + dual paymaster routing (SA/Coinbase/EOA)"
```

---

## Task 4 (S2): email/social 登录 → SA 端到端验证

**Files:** 无代码变更（验证任务）

- [ ] **Step 1: 本地验证 SA 创建**

`npm run dev` → 打开站点 → AppKit 按钮 → email 登录 → 观察：
1. 内嵌钱包创建成功，显示 counterfactual 地址
2. `useAccount().address` 返回 SA 地址
3. 浏览器 localStorage 出现内嵌钱包会话标记

- [ ] **Step 2: 首笔交易部署验证**

连接 SA → 充值页 → mintWithEth（需要 SA 有 ETH 或 paymaster）→ 确认首笔交易自动部署 SA → 交易成功

- [ ] **Step 3: EOA 并存回归**

MetaMask 连接 → 原流程（mint/充值/API key）全回归

- [ ] **Step 4: 账户切换**

AppKit 内 SA ↔ EOA 切换 → 状态隔离正确（SIWE session 按地址隔离）

- [ ] **Step 5: 记录验证结果**

在报告中记录每步实际结果；若 SA 创建/部署因环境（无 email 验证码发送能力、无 Pimlico key）受阻，记录为 DONE_WITH_CONCERNS 并说明受限项。

---

## Task 5 (S4): 浏览器 E2E 全回归

**Files:** 无代码变更（验证任务）

- [ ] **Step 1: 本地全回归**

用 web-gui-tester（或手动浏览器）验证：
- 未连接状态：首页/充值页/设置页正常渲染
- EOA 连接：mint / credits / keys / settings 全流程
- SA 连接（若可用）：充值、API key 注册（SIWE 1271/6492）
- 断连：SIWE session 清除（HandleWalletEvents）

- [ ] **Step 2: 生产验证（CI 已修复）**

push main → CI 自动部署（Pages + billing worker）→ 验证生产站点钱包按钮为 AppKit、EOA 可连接。

---

## Task 6: 文档更新 + 收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-reown-smart-account-design.md`（§8 状态标记）

- [ ] **Step 1: 更新 spec §8**

将 S1-S4 行标记 ✅ 完成（按实际完成情况）。

- [ ] **Step 2: 全量测试 + 构建**

Run: `npx vitest run` + `npm run build` — 全部通过。

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-04-reown-smart-account-design.md
git commit -m "docs(wallet): Reown smart account S1-S4 complete (spec §8)"
```
