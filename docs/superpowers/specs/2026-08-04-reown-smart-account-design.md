# 外部 EOA + Reown Smart Account 双钱包支持 — 设计方案

- **日期**: 2026-08-04
- **状态**: 已批准（用户确认"ok"）
- **范围**: 将钱包连接层从 RainbowKit 迁移到 Reown AppKit，新增 Reown 内嵌钱包（email/social 登录 → ERC-4337 Smart Account），与外部 EOA（MetaMask/WalletConnect/Coinbase）并存
- **目标网络**: Base Sepolia（与现有合约一致），主网同构迁移

---

## 1. 需求与已确认决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 目标用户场景 | **新增入口**：email/social 登录用户默认获得 Reown Smart Account；外部钱包保持 EOA 并存 |
| 2 | 钱包连接 UI | **替换 RainbowKit** → AppKit（wagmi adapter 兼容现有 hooks） |
| 3 | SIWE 适配 | **升级 SIWE**：用 `viem.verifyMessage` 支持 EIP-1271/6492 签名验证 |
| 4 | Gas 费用模式 | **双 paymaster**：SA 用户走 Reown 内置 Pimlico；Coinbase EOA 保留现有 CDP proxy |

---

## 2. 架构总览

```
┌────────────────────── AppKit（替换 RainbowKit，单一 provider）────────────────────┐
│  WagmiAdapter (wagmi 2.14 兼容) — 现有 useAccount/useWriteContract 零改动          │
│                                                                                    │
│  ┌─ 外部 EOA ───────────────┐   ┌─ Reown 内嵌钱包（新入口）───────────────────┐   │
│  │ injected (MetaMask)      │   │ email / social 登录                          │   │
│  │ WalletConnect (mobile)   │   │ → ERC-4337 Smart Account（默认启用）         │   │
│  │ Coinbase Wallet          │   │ → counterfactual 地址，首笔交易部署          │   │
│  └──────────────────────────┘   │ → 用户可访问/自托管其 EOA                   │   │
│                                └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────┘
        │ EIP-5792                              │ ERC-4337 UserOp
        ▼                                       ▼
  CDP Paymaster proxy（现有 worker）      Pimlico Paymaster（AppKit 内置）
  — Coinbase Smart Wallet EOA 用户        — Reown SA 用户（gasless）
```

**核心事实（Reown 官方文档）**：
- Smart Account **默认启用**，遵循 ERC-4337；counterfactual 地址，首笔交易时部署
- Smart Account **仅对内嵌钱包用户（email/social 登录）可用**；外部 EOA 连接保持 EOA —— 两者在同一 AppKit 实例内并存
- SA 发出 **EIP-1271（已部署）/ EIP-6492（未部署）** 签名；`viem.verifyMessage` 原生支持 1271/6492/8010
- 内嵌钱包用户登录后同时拥有 SA 与其 EOA（仅 EOA 可导出/自托管）

---

## 3. 组件与文件变更

| 文件 | 动作 | 说明 |
|---|---|---|
| `components/providers/rainbow-kit.tsx` | 重写为 `appkit-provider.tsx` | `createAppKit` + `WagmiAdapter`；`features: { email: true, socials: [...] }`；保留现有 `createStorage(localStorage/noopStorage)` + `ssr:false`（prerender 安全） |
| `components/providers/root-provider.tsx` | 改引用新 provider | 组件树结构不变 |
| `components/shared/wallet-connect.tsx` | 连接按钮改 AppKit | RainbowKit `ConnectButton` → AppKit `AppKitButton`（或保留 wagmi 自绘按钮） |
| `lib/hooks/use-siwe.ts` | 升级签名验证 | `signMessageAsync` 不变（wagmi 自动路由到 SA 签名）；验证端改用 `viem.verifyMessage`（EIP-1271/6492 兼容） |
| `lib/hooks/use-paymaster.ts` | 增加账户类型分支 | 检测 SA（`embeddedWalletInfo.accountType`）→ Pimlico；Coinbase EOA → 现有 CDP proxy；普通 EOA → 自付 gas |
| `config/networks.ts` | 不变 | 单链 Base Sepolia |
| `.env.local` / `.env.production` | +`NEXT_PUBLIC_REOWN_PROJECT_ID`、`NEXT_PUBLIC_PIMLICO_API_KEY` | Reown 沿用现有 WC project id 或新建；Pimlico key 可选（SA 自付 gas 模式可省略） |
| `package.json` | +`@reown/appkit`、`@reown/appkit-adapter-wagmi`；−`@rainbow-me/rainbowkit` | 依赖替换 |

**业务代码零改动原则**：所有 `useAccount`/`useWriteContract`/`useSignMessage`/`useSendCalls` 调用点不变 —— WagmiAdapter 产生与 RainbowKit 相同的 wagmi config 语义。

---

## 4. 关键设计点

### 4.1 Provider 配置（appkit-provider.tsx 核心）

```tsx
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet, baseSepolia } from "@reown/appkit/networks"

const projectId = env.NEXT_PUBLIC_REOWN_PROJECT_ID

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [baseSepolia],           // 与 config/networks 一致
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
})

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [baseSepolia],
  features: {
    email: true,                       // SA 入口（新）
    socials: ["google", "x", "github"],// SA 入口（新，可按需裁剪）
  },
  metadata: {
    name: siteConfig.title,
    description: siteConfig.description,
    url: typeof window !== "undefined" ? window.location.href : "",
    icons: [],
  },
  themeMode: colorMode,                // 延续现有明暗主题
})
```

- EOA 连接器（injected / WalletConnect / Coinbase）由 AppKit **开箱即用**，无需显式配置
- `ssr: false` + storage 处理延续现有模式，静态导出不崩溃

### 4.2 账户类型判定（use-paymaster 分支）

```ts
// 检测当前账户类型：sa | coinbase-smart-wallet | eoa
const accountType = useMemo(() => {
  if (embeddedWalletInfo?.accountType === "smartAccount") return "sa"
  if (chainCaps?.paymasterService?.supported) return "coinbase-smart-wallet"
  return "eoa"
}, [embeddedWalletInfo, chainCaps])
```

- **sa** → 走 AppKit 内置 UserOp 流程（AppKit 自动处理 paymaster 路由）
- **coinbase-smart-wallet** → 现有 `use-paymaster.ts` capabilities（CDP proxy）
- **eoa** → 无 capabilities，用户自付 gas

### 4.3 SIWE 适配（EIP-1271/6492）

- 签名端：`useSignMessage` 对 SA 自动输出 1271（已部署）或 6492（未部署）包装签名 —— 前端无需改动
- 验证端：把 `signMessage` 的裸校验替换为 `viem.verifyMessage`（服务端或 worker 侧）：

```ts
import { verifyMessage } from "viem"
const valid = await verifyMessage(publicClient, {
  address, message, signature,  // signature 可为 1271/6492 包装
})
```

- 现有客户端 SIWE 为 UX-only（session 存 localStorage，24h 过期）—— 保持此定位，仅验证算法升级

### 4.4 计费系统衔接

- **充值**：SA 用户 `mintWithEth` 前需有 ETH —— 首笔充值/操作前 AppKit 自动部署账户；UI 提示"首笔交易将部署您的账户"
- **API Key 注册**：`use-api-keys.ts` 的 SIWE 门控自动受益于 4.3（SA 可签名）
- **托管账户**：owner 字段为 SA 地址，逻辑不变（地址即身份）

---

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| SA 未部署时地址为 counterfactual（非最终地址） | AppKit 自动在首笔交易部署；充值/领取前 UI 提示 |
| SIWE 对 SA 验证失败（旧版 AppKit bug：缺 6492 支持） | 用 `viem.verifyMessage`（官方推荐，覆盖 1271+6492）；锁定 AppKit ≥ v1.5 相关修复版本 |
| 双 paymaster 切换复杂度 | 统一封装 `usePaymasterForAccount()`，单出口 |
| RainbowKit 删除影响面 | 全仓 grep `rainbowkit`/`RainbowKit`/`ConnectButton` 清理残留；构建验证 |
| email/social 用户 SA 默认启用但想用 EOA | AppKit 内置账户切换；文档说明"设置 → 访问我的 EOA" |
| Pimlico key 未配置 | SA 用户退化为自付 gas（功能可用，非阻断） |

---

## 6. 测试策略

- **单元**：
  - SIWE 验证：mock 1271（已部署 SA）与 6492（未部署 SA）签名 → `verifyMessage` 路径通过
  - `usePaymasterForAccount`：三种账户类型 → 正确 paymaster 出口
- **浏览器 E2E**（web-gui-tester）：
  - email 登录 → SA 创建 → counterfactual 地址显示 → 充值/铸造（首笔交易部署）→ 扣费正常
  - MetaMask 注入（或模拟 injected）→ EOA 原流程回归（mint/充值/API key）
  - 账户切换：SA ↔ EOA 状态隔离
- **构建**：`npm run build` 静态导出通过（prerender 无 indexedDB 崩溃）

---

## 7. 非目标（YAGNI，本轮不做）

- 多链支持（AppKit 能力已具备，但合约仅在 Base Sepolia —— 保持单链）
- SA 的代付 gas 赞助池（应用层赞助模式，后续可叠加）
- 邮件验证码自定义域名/品牌化（用 AppKit 默认）
- 与现有 Coinbase Smart Wallet 的迁移合并（两个 SA 体系并存，互不干扰）

---

## 8. 部署路径

| 阶段 | 内容 | 验收 |
|---|---|---|
| **S1** | 依赖替换 + AppKit provider + 连接按钮迁移 | 构建通过；MetaMask EOA 全流程回归 |
| **S2** | email/social 登录 → SA 创建 → 首笔交易部署 → 充值/铸造 | SA 端到端可用 |
| **S3** | SIWE 1271/6492 验证升级 + paymaster 分支 | SA 可完成 SIWE；三种账户 gas 路径正确 |
| **S4** | 浏览器 E2E 全回归 + 生产部署（CI 已修复） | 生产验证双钱包入口 |

> 依赖 CI 部署修复（`CLOUDFLARE_ACCOUNT_ID` secret 已设置，deploy workflow 已验证成功）。
