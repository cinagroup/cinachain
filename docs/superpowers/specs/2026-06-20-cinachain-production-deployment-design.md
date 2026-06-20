# CinaChain NFT DApp 生产级落地方案设计文档

**创建日期**: 2026-06-20  
**项目**: cinagroup/cinachain  
**上游模板**: turbo-eth/template-web3-app  
**目标域名**: cinachain.com  
**DApp 主站**: nft.cinachain.com  
**状态**: 待实施

---

## 一、项目概述

### 1.1 项目目标

将 `turbo-eth/template-web3-app` 改造为 CinaChain NFT DApp，实现：
- 品牌完全替换（CinaChain / cinagroup）
- Cloudflare 全栈部署（Pages + Workers + KV + R2）
- NFT 展示、铸造、持仓管理完整功能
- 白名单 + 公开阶段铸造机制
- 生产级安全、性能、可维护性

### 1.2 三阶段交付路线图

| 阶段 | 目标 | 周期 | 交付物 |
|------|------|------|--------|
| **Phase 1** | 快速验证 | 2 周 | 品牌替换 + CF Pages 部署 + NFT 展示页 + 白名单 API |
| **Phase 2** | 核心功能 | 3 周 | 铸造系统 + 持仓 Dashboard + 代码瘦身重构 |
| **Phase 3** | 运营工具 | 2 周 | Admin 后台 + 数据看板 + 合约管理 |

---

## 二、系统架构

### 2.1 基础设施架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare 全域                             │
│                                                               │
│  nft.cinachain.com ──── CF Pages (Next.js SSR)               │
│  api.cinachain.com ──── CF Workers + KV + D1                 │
│  ipfs.cinachain.com ─── CF IPFS Gateway                      │
│  rpc.cinachain.com ──── CF Ethereum Gateway                  │
│                                                               │
│  R2: cinachain-nft-backup (素材备份)                          │
└─────────────────────────────────────────────────────────────┘
         │                    │                  │
         ▼                    ▼                  ▼
    用户浏览器           NFT.Storage        以太坊主网
   (RainbowKit)      (IPFS Pin 主源)     (ERC721 合约)
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Next.js 14 + React 18 | SSR/SSG 混合渲染 |
| 样式系统 | TailwindCSS + Radix UI + shadcn/ui | 原子化 CSS + 无障碍组件 |
| Web3 交互 | wagmi v2 + viem + RainbowKit | 类型安全的合约交互 |
| 状态管理 | Jotai | 轻量原子状态，适合 Web3 场景 |
| 部署 | Cloudflare Pages + @cloudflare/next-on-pages | 边缘部署，低延迟 |
| 后端 API | Cloudflare Workers + KV + D1 | 边缘计算 + 键值缓存 + SQL 数据库 |
| 存储 | NFT.Storage (IPFS) + Cloudflare R2 | 双备份，防单点故障 |
| 认证 | RainbowKit 钱包连接 + SIWE | 分层认证（普通用户/管理员） |
| CI/CD | GitHub Actions → Cloudflare Pages | 自动构建部署 |

### 2.3 应用目录结构（Phase 2 重构后的目标态）

```
app/
├── (marketing)/           # 落地页、关于
│   └── page.tsx
├── (general)/             # 公开页面
│   ├── explore/           # NFT 探索/画廊
│   ├── collection/[id]/   # 单个 NFT 详情
│   └── mint/              # 铸造页面
├── dashboard/             # 用户 Dashboard（需钱包连接）
│   ├── page.tsx           # 持仓概览
│   ├── history/           # 铸造历史
│   └── favorites/         # 收藏夹
├── admin/                 # 管理后台（需 SIWE 登录）
│   ├── page.tsx           # 数据看板
│   ├── whitelist/         # 白名单管理
│   └── contract/          # 合约操作
└── api/                   # Next.js API Routes (CF Pages Functions)
    ├── whitelist/         # 白名单查询 & Merkle Proof
    └── metadata/          # NFT 元数据代理

lib/
├── ipfs.ts               # IPFS 工具库
├── contracts/            # 合约交互封装
│   └── cina-nft.ts
├── hooks/                # 自定义 Hooks
│   ├── use-nft.ts
│   └── use-whitelist.ts
└── utils/                # 工具函数

components/
├── CinaNftImage.tsx      # NFT 图片组件（带网关降级）
├── blockchain/           # Web3 组件
└── ui/                   # 通用 UI 组件

workers/
└── whitelist/            # 白名单 API（独立 CF Workers 项目）
    ├── src/
    │   └── index.ts
    ├── wrangler.toml
    └── package.json
```

---

## 三、Phase 1 详细设计（快速验证，2 周）

### 3.1 交付清单

| 任务 | 优先级 | 预估工时 | 交付物 |
|------|--------|----------|--------|
| 品牌全局替换 | P0 | 0.5 天 | 所有文件 `turbo-eth` → `cinagroup` |
| Cloudflare Pages 部署配置 | P0 | 1 天 | wrangler.toml、next.config.mjs、package.json 脚本 |
| IPFS 工具库 + NFT 图片组件 | P0 | 1 天 | `lib/ipfs.ts`、`components/CinaNftImage.tsx` |
| wagmi RPC 配置改造 | P0 | 0.5 天 | 对接 `rpc.cinachain.com` 私有网关 |
| NFT 展示页（只读） | P0 | 2 天 | `/explore` 页面，从合约读取持仓 |
| 白名单 API（CF Workers） | P1 | 2 天 | `api.cinachain.com/whitelist/:address` |
| 环境变量 & Secret 配置 | P1 | 0.5 天 | `.env.local` + Cloudflare Pages 后台 |
| 部署验证 & 冒烟测试 | P1 | 1 天 | 端到端验证清单 |

### 3.2 品牌全局替换

**替换规则**：
```
turbo-eth → cinagroup
TurboETH → CinaChain
Template Web3 App → CinaChain NFT DApp
turboeth.xyz → cinachain.com
```

**受影响文件**：
- `config/site.ts`（SITE_CANONICAL、siteConfig）
- `package.json`（name、repository、author）
- `README.md`（标题、描述、徽章）
- `public/manifest.json`（name、short_name）
- `app/layout.tsx`（metadata）
- `components/layout/site-header.tsx`、`footer.tsx`
- 所有集成模块的品牌文字（约 15 个页面）

**执行方式**：
1. 用 `sed` 批量替换（提供脚本）
2. 手动检查并修正特殊位置（README、manifest.json）
3. 替换品牌素材（favicon、logo 暂用占位图，Phase 3 设计稿到位后替换）

### 3.3 Cloudflare Pages 部署配置

#### 3.3.1 `wrangler.toml`（新增）

```toml
name = "cinachain-nft-dapp"
compatibility_date = "2026-06-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[vars]
NEXT_PUBLIC_CF_IPFS_GATEWAY = "https://ipfs.cinachain.com"
NEXT_PUBLIC_CF_RPC_ENDPOINT = "https://rpc.cinachain.com/v1"
NEXT_PUBLIC_CINA_NFT_CONTRACT = "0xYourContractAddress"
NEXT_PUBLIC_WC_PROJECT_ID = "your-walletconnect-project-id"

# KV 命名空间（白名单缓存）
[[kv_namespaces]]
binding = "CINA_WHITELIST_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

#### 3.3.2 `next.config.mjs`（改造）

```javascript
import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.cinachain.com" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "ipfs.io" },
    ],
  },
  env: {
    mode: process.env.NODE_ENV,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    return config
  },
}

// 本地开发 Cloudflare Pages 兼容
if (process.env.NODE_ENV === "development") {
  const { setupDevPlatform } = await import("@cloudflare/next-on-pages/next-dev")
  await setupDevPlatform()
}

export default nextConfig
```

#### 3.3.3 `package.json`（新增脚本）

```json
{
  "name": "cinachain-nft-dapp",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:preview": "pnpm pages:build && wrangler pages dev .vercel/output/static",
    "pages:deploy": "pnpm pages:build && wrangler pages deploy .vercel/output/static"
  },
  "devDependencies": {
    "@cloudflare/next-on-pages": "^1.13.0",
    "wrangler": "^3.60.0"
  }
}
```

#### 3.3.4 部署流程

```bash
# 本地预览
pnpm pages:preview

# 部署到 Cloudflare Pages
pnpm pages:deploy

# 或通过 GitHub Actions 自动部署
# .github/workflows/deploy.yml（Phase 1 提供）
```

### 3.4 IPFS 工具库 + NFT 图片组件

#### 3.4.1 `lib/ipfs.ts`（新增）

```typescript
const PRIMARY_GATEWAY = process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY!
const FALLBACK_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
]

/** ipfs://CID 转为 HTTPS 链接 */
export function ipfsToHttps(uri: string): string {
  if (!uri.startsWith("ipfs://")) return uri
  const cid = uri.replace("ipfs://", "")
  return `${PRIMARY_GATEWAY}/ipfs/${cid}`
}

/** 获取网关优先级数组（用于图片加载失败自动切换） */
export function getIpfsImageSources(ipfsUri: string): string[] {
  const cid = ipfsUri.replace("ipfs://", "")
  const sources = [`${PRIMARY_GATEWAY}/ipfs/${cid}`]
  FALLBACK_GATEWAYS.forEach((gw) => sources.push(`${gw}${cid}`))
  return sources
}
```

#### 3.4.2 `components/CinaNftImage.tsx`（新增）

```typescript
"use client"
import Image from "next/image"
import { useState } from "react"
import { getIpfsImageSources } from "@/lib/ipfs"

type Props = {
  ipfsCidUrl: string
  alt: string
  fill?: boolean
  className?: string
}

export default function CinaNftImage({ ipfsCidUrl, alt, fill = true, className }: Props) {
  const sourceList = getIpfsImageSources(ipfsCidUrl)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleImageError = () => {
    if (activeIndex < sourceList.length - 1) {
      setActiveIndex((prev) => prev + 1)
    }
  }

  return (
    <Image
      src={sourceList[activeIndex]}
      alt={alt}
      fill={fill}
      sizes="(max-width:768px) 100vw, 420px"
      onError={handleImageError}
      className={className}
    />
  )
}
```

### 3.5 wagmi RPC 配置改造

**`config/networks.ts`（改造）**

```typescript
import { http } from "wagmi"
import { mainnet, sepolia } from "wagmi/chains"

const rpcUrl = process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT
  ? `${process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT}?token=${process.env.CF_RPC_SERVICE_AUTH_TOKEN}`
  : undefined

export const chains = [mainnet, sepolia] as const

export const transports = {
  [mainnet.id]: http(rpcUrl, {
    batch: true,
    cacheTime: 1000 * 60 * 5,
  }),
  [sepolia.id]: http(), // 测试网用公共 RPC
} as const
```

### 3.6 NFT 展示页（只读）

#### 3.6.1 `app/(general)/explore/page.tsx`（新增）

```typescript
import { getCinaNftContract } from "@/lib/contracts/cina-nft"
import { ipfsToHttps } from "@/lib/ipfs"
import CinaNftImage from "@/components/CinaNftImage"
import Link from "next/link"

export default async function ExplorePage() {
  const contract = getCinaNftContract()
  const totalSupply = await contract.read.totalSupply()
  
  // 获取前 20 个 NFT
  const nfts = await Promise.all(
    Array.from({ length: Math.min(20, Number(totalSupply)) }, async (_, i) => {
      const tokenId = BigInt(i + 1)
      const tokenURI = await contract.read.tokenURI([tokenId])
      return { tokenId: tokenId.toString(), tokenURI }
    })
  )

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">CinaChain NFT Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {nfts.map((nft) => (
          <Link key={nft.tokenId} href={`/collection/${nft.tokenId}`}>
            <div className="aspect-square relative rounded-lg overflow-hidden">
              <CinaNftImage ipfsCidUrl={nft.tokenURI} alt={`NFT #${nft.tokenId}`} />
            </div>
            <p className="mt-2 text-center">#{nft.tokenId}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

#### 3.6.2 `lib/contracts/cina-nft.ts`（新增）

```typescript
import { readContract } from "@wagmi/core"
import { parseAbiItem } from "viem"
import { wagmiConfig } from "@/components/providers/rainbow-kit"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`

const ABI = [
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem("function ownerOf(uint256 tokenId) view returns (address)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),
] as const

export function getCinaNftContract() {
  return {
    read: {
      totalSupply: () =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "totalSupply",
        }),
      tokenURI: (args: [bigint]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "tokenURI",
          args,
        }),
      ownerOf: (args: [bigint]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "ownerOf",
          args,
        }),
      balanceOf: (args: [`0x${string}`]) =>
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "balanceOf",
          args,
        }),
    },
  }
}
```

### 3.7 白名单 API（Cloudflare Workers）

#### 3.7.1 `workers/whitelist/src/index.ts`（新增独立项目）

```typescript
import { MerkleTree } from "merkletreejs"
import { keccak256, solidityKeccak256 } from "ethers/lib/utils"

export interface Env {
  CINA_WHITELIST_KV: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const address = url.pathname.split("/")[2]?.toLowerCase()

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return new Response("Invalid address", { status: 400 })
    }

    // 从 KV 获取白名单 Merkle Root 和叶子节点
    const whitelistData = await env.CINA_WHITELIST_KV.get("whitelist:current", "json")
    if (!whitelistData) {
      return new Response("Whitelist not configured", { status: 500 })
    }

    const { merkleRoot, addresses } = whitelistData as {
      merkleRoot: string
      addresses: string[]
    }

    // 检查地址是否在白名单中
    const isInWhitelist = addresses.includes(address.toLowerCase())
    if (!isInWhitelist) {
      return Response.json({ eligible: false, proof: null })
    }

    // 生成 Merkle Proof
    const leaves = addresses.map((addr) => solidityKeccak256(["address"], [addr]))
    const tree = new MerkleTree(leaves, keccak256)
    const leafIndex = addresses.indexOf(address.toLowerCase())
    const proof = tree.getProof(leaves[leafIndex]).map((p) => "0x" + p.data.toString("hex"))

    return Response.json({
      eligible: true,
      proof,
      merkleRoot,
      mintLimit: 3, // 每个白名单地址最多铸造 3 个
    })
  },
}
```

#### 3.7.2 `workers/whitelist/wrangler.toml`

```toml
name = "cinachain-whitelist-api"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "CINA_WHITELIST_KV"
id = "YOUR_KV_NAMESPACE_ID"

[vars]
API_VERSION = "v1"
```

#### 3.7.3 部署命令

```bash
cd workers/whitelist
wrangler deploy
# API 地址: https://api.cinachain.com/whitelist/:address
```

### 3.8 环境变量 & Secret 配置

#### 3.8.1 `.env.local`（根目录，本地开发用）

```env
# Cloudflare Web3 网关
NEXT_PUBLIC_CF_IPFS_GATEWAY=https://ipfs.cinachain.com
NEXT_PUBLIC_CF_RPC_ENDPOINT=https://rpc.cinachain.com/v1
CF_RPC_SERVICE_AUTH_TOKEN=cf-web3-rpc-token-xxxxxx

# NFT 合约
NEXT_PUBLIC_CINA_NFT_CONTRACT=0xYourCinaChainNFTContractAddress

# WalletConnect
NEXT_PUBLIC_WC_PROJECT_ID=wc-project-id-here

# 站点域名
NEXT_PUBLIC_APP_DOMAIN=https://nft.cinachain.com
NEXT_PUBLIC_SITE_URL=https://nft.cinachain.com

# SIWE（管理员登录用）
NEXTAUTH_SECRET=complex_password_at_least_32_characters_long
```

#### 3.8.2 Cloudflare Pages 后台配置

- 在 Pages 项目 → Settings → Environment variables 中填入上述变量
- Secret 变量（如 `CF_RPC_SERVICE_AUTH_TOKEN`）使用 Encrypt 功能

#### 3.8.3 Cloudflare Workers KV 初始化

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "CINA_WHITELIST_KV"

# 写入白名单数据（示例）
wrangler kv:key put --binding CINA_WHITELIST_KV "whitelist:current" '{
  "merkleRoot": "0x...",
  "addresses": ["0x123...", "0x456..."]
}'
```

### 3.9 部署验证 & 冒烟测试

#### 3.9.1 验证清单

| 验证项 | 预期结果 | 测试命令/步骤 |
|--------|----------|---------------|
| 品牌替换 | 页面无 "TurboETH" 字样 | 全局搜索 `turbo-eth`、`TurboETH` |
| Pages 构建 | `pnpm pages:build` 成功 | 检查 `.vercel/output/static` 生成 |
| Pages 部署 | 访问 `nft.cinachain.com` 正常 | 浏览器访问 |
| IPFS 图片加载 | NFT 图片从 `ipfs.cinachain.com` 加载 | 浏览器 DevTools Network 面板 |
| RPC 网关 | 合约调用走 `rpc.cinachain.com` | Network 面板检查请求 |
| NFT 展示页 | `/explore` 页面显示 NFT 列表 | 访问页面，检查数据加载 |
| 白名单 API | `api.cinachain.com/whitelist/0x...` 返回正确 Proof | curl 测试 |
| 钱包连接 | RainbowKit 弹窗显示 "CinaChain" | 点击 Connect Wallet |

#### 3.9.2 冒烟测试脚本

```bash
# 测试白名单 API
curl https://api.cinachain.com/whitelist/0xYourTestAddress

# 预期响应
# {
#   "eligible": true,
#   "proof": ["0x...", "0x..."],
#   "merkleRoot": "0x...",
#   "mintLimit": 3
# }
```

### 3.10 Phase 1 交付物清单

- [ ] 品牌替换完成，全局无 TurboETH 字样
- [ ] `wrangler.toml` 配置完成
- [ ] `next.config.mjs` 改造完成
- [ ] `lib/ipfs.ts` 工具库
- [ ] `components/CinaNftImage.tsx` 组件
- [ ] `config/networks.ts` RPC 改造
- [ ] `app/(general)/explore/page.tsx` NFT 展示页
- [ ] `lib/contracts/cina-nft.ts` 合约交互封装
- [ ] `workers/whitelist/` 白名单 API 项目
- [ ] `.env.local` 环境变量模板
- [ ] `.github/workflows/deploy.yml` CI/CD 配置
- [ ] 部署验证文档（验证清单 + 冒烟测试）

---

## 四、Phase 2 详细设计（核心功能，3 周）

### 4.1 交付清单

| 任务 | 优先级 | 预估工时 | 交付物 |
|------|--------|----------|--------|
| 代码瘦身（移除不需要的集成） | P0 | 2 天 | 删除 15+ 个集成模块 |
| 铸造页面（白名单 + 公开阶段） | P0 | 3 天 | `/mint` 页面，支持两阶段铸造 |
| 用户 Dashboard | P0 | 3 天 | `/dashboard` 持仓概览、铸造历史 |
| NFT 详情页 | P1 | 2 天 | `/collection/[id]` 页面 |
| Merkle Proof 合约集成 | P1 | 2 天 | 合约端验证白名单 Proof |
| 铸造状态机 | P1 | 2 天 | 白名单阶段 → 公开阶段切换 |
| 收藏功能（本地存储） | P2 | 1 天 | localStorage 持久化 |

### 4.2 铸造页面设计

#### 4.2.1 铸造流程

```
用户连接钱包
    ↓
查询白名单资格（调用 api.cinachain.com）
    ↓
  是否在白名单？
    ├─ 是 → 显示白名单铸造界面（限量 3 个）
    │       ↓
    │     用户选择铸造数量（1-3）
    │       ↓
    │     调用合约 mintWhitelist(proof, quantity)
    │
    └─ 否 → 检查是否在公开阶段
            ├─ 是 → 显示公开铸造界面（无限量，固定价格）
            │       ↓
            │     用户选择铸造数量
            │       ↓
            │     调用合约 mintPublic(quantity) { value: price * quantity }
            │
            └─ 否 → 显示"铸造未开始"提示
```

#### 4.2.2 `app/(general)/mint/page.tsx`（新增）

```typescript
"use client"
import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useWhitelist } from "@/lib/hooks/use-whitelist"
import { useMintContract } from "@/lib/hooks/use-mint-contract"

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: whitelistData, isLoading: whitelistLoading } = useWhitelist(address)
  const { mintWhitelist, mintPublic, isLoading: mintLoading } = useMintContract()
  const [quantity, setQuantity] = useState(1)

  const isWhitelisted = whitelistData?.eligible
  const mintLimit = whitelistData?.mintLimit || 0

  const handleMint = async () => {
    if (!address) return
    
    if (isWhitelisted) {
      await mintWhitelist(whitelistData.proof, quantity)
    } else {
      await mintPublic(quantity)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Mint CinaChain NFT</h1>
      
      {!isConnected && <p>请先连接钱包</p>}
      
      {isConnected && (
        <div className="space-y-6">
          {whitelistLoading && <p>正在检查白名单资格...</p>}
          
          {isWhitelisted && (
            <div>
              <p>您是白名单用户，可铸造 {mintLimit} 个 NFT</p>
              <input
                type="number"
                min={1}
                max={mintLimit}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
          )}
          
          {!isWhitelisted && !whitelistLoading && (
            <div>
              <p>公开铸造阶段，每个 NFT 价格: 0.05 ETH</p>
              <input
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
          )}
          
          <button
            onClick={handleMint}
            disabled={mintLoading || quantity < 1}
          >
            {mintLoading ? "铸造中..." : `铸造 ${quantity} 个 NFT`}
          </button>
        </div>
      )}
    </div>
  )
}
```

#### 4.2.3 `lib/hooks/use-whitelist.ts`（新增）

```typescript
import { useQuery } from "@tanstack/react-query"
import { Address } from "viem"

export function useWhitelist(address?: Address) {
  return useQuery({
    queryKey: ["whitelist", address],
    queryFn: async () => {
      if (!address) return null
      const res = await fetch(`https://api.cinachain.com/whitelist/${address}`)
      if (!res.ok) throw new Error("Failed to fetch whitelist data")
      return res.json() as Promise<{
        eligible: boolean
        proof: string[] | null
        merkleRoot: string | null
        mintLimit: number
      }>
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 分钟缓存
  })
}
```

### 4.3 用户 Dashboard

#### 4.3.1 `app/dashboard/page.tsx`（新增）

```typescript
"use client"
import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft"
import CinaNftImage from "@/components/CinaNftImage"

export default function DashboardPage() {
  const { address } = useAccount()
  const { data: balance } = useNftBalance(address)
  
  // TODO: 获取用户持有的 NFT 列表（通过 The Graph 或合约事件）
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">我的持仓</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">持有 NFT</h2>
          <p className="text-4xl">{balance?.toString() || 0}</p>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mt-12 mb-6">我的 NFT</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* TODO: 渲染用户持有的 NFT */}
      </div>
    </div>
  )
}
```

### 4.4 代码瘦身（移除不需要的集成）

**删除的集成模块**（约 15 个）：
- `integrations/aave/` - DeFi 借贷，不需要
- `integrations/connext/` - 跨链桥，不需要
- `integrations/defi-llama/` - DeFi 数据，不需要
- `integrations/disco/` - 凭证系统，不需要
- `integrations/etherscan/` - 区块浏览器，保留（Phase 3 用）
- `integrations/gelato/` - 自动化任务，不需要
- `integrations/gitcoin-passport/` - 身份验证，不需要
- `integrations/lens-protocol/` - 社交协议，不需要
- `integrations/lit-protocol/` - 加密访问控制，不需要
- `integrations/livepeer/` - 视频流，不需要
- `integrations/moralis/` - Web3 API，不需要
- `integrations/openai/` - AI 功能，不需要
- `integrations/push-protocol/` - 通知推送，不需要
- `integrations/session-keys/` - 会话密钥，不需要
- `integrations/arweave/` - 永久存储，不需要

**保留的集成**：
- `integrations/erc721/` - NFT 标准，需要
- `integrations/erc20/` - ERC20 代币，需要（未来扩展）
- `integrations/siwe/` - 登录认证，需要（管理员）
- `integrations/etherscan/` - 区块浏览器链接，需要

### 4.5 Phase 2 交付物清单

- [ ] 删除 15+ 个不需要的集成模块
- [ ] `app/(general)/mint/page.tsx` 铸造页面
- [ ] `lib/hooks/use-whitelist.ts` 白名单 Hook
- [ ] `lib/hooks/use-mint-contract.ts` 铸造合约 Hook
- [ ] `app/dashboard/page.tsx` 用户 Dashboard
- [ ] `app/(general)/collection/[id]/page.tsx` NFT 详情页
- [ ] Merkle Proof 合约集成（需合约端配合）
- [ ] 铸造状态机逻辑
- [ ] 收藏功能（localStorage）

---

## 五、Phase 3 详细设计（运营工具，2 周）

### 5.1 交付清单

| 任务 | 优先级 | 预估工时 | 交付物 |
|------|--------|----------|--------|
| Admin Dashboard | P0 | 3 天 | `/admin` 数据看板、铸造统计 |
| 白名单管理后台 | P0 | 3 天 | 上传 CSV、更新 Merkle Root |
| 合约管理界面 | P1 | 2 天 | 暂停/恢复铸造、提取资金 |
| 数据看板 | P1 | 2 天 | 链上事件监控、Gas 分析 |
| 品牌设计稿替换 | P2 | 1 天 | favicon、logo、OG 图片 |

### 5.2 Admin Dashboard

#### 5.2.1 `app/admin/page.tsx`（新增）

```typescript
"use client"
import { useAccount } from "wagmi"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"

export default function AdminDashboard() {
  const { address } = useAccount()
  const { data: session } = useSession()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // 检查是否是管理员地址
    const admins = process.env.NEXT_PUBLIC_APP_ADMINS?.split(",") || []
    if (address && admins.includes(address.toLowerCase())) {
      setIsAuthorized(true)
    } else {
      router.push("/")
    }
  }, [address, router])

  if (!session) {
    return (
      <div>
        <p>请使用管理员钱包登录</p>
        <button onClick={() => signIn("ethereum")}>SIWE 登录</button>
      </div>
    )
  }

  if (!isAuthorized) {
    return <p>无权限访问</p>
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">总铸造量</h2>
          <p className="text-4xl">0 / 10000</p>
        </div>
        <div className="bg-card p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">白名单铸造</h2>
          <p className="text-4xl">0</p>
        </div>
        <div className="bg-card p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">公开铸造</h2>
          <p className="text-4xl">0</p>
        </div>
      </div>
      
      {/* TODO: 铸造趋势图、Gas 分析、最近事件列表 */}
    </div>
  )
}
```

#### 5.2.2 `app/admin/whitelist/page.tsx`（新增）

```typescript
"use client"
import { useState } from "react"
import { useDropzone } from "react-dropzone"

export default function WhitelistManagement() {
  const [addresses, setAddresses] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    const text = await file.text()
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l)
    setAddresses(lines)
  }

  const { getRootProps, getInputProps } = useDropzone({ onDrop })

  const handleUpdateWhitelist = async () => {
    setIsUploading(true)
    // TODO: 调用 API 上传白名单，生成 Merkle Root，更新合约
    setIsUploading(false)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">白名单管理</h1>
      
      <div {...getRootProps()} className="border-2 border-dashed p-12 text-center cursor-pointer">
        <input {...getInputProps()} />
        <p>拖拽 CSV 文件到此处，或点击选择文件</p>
      </div>
      
      {addresses.length > 0 && (
        <div className="mt-6">
          <p>已加载 {addresses.length} 个地址</p>
          <button onClick={handleUpdateWhitelist} disabled={isUploading}>
            {isUploading ? "更新中..." : "更新白名单"}
          </button>
        </div>
      )}
    </div>
  )
}
```

### 5.3 合约管理界面

#### 5.3.1 `app/admin/contract/page.tsx`（新增）

```typescript
"use client"
import { useContractWrite } from "wagmi"
import { parseAbi } from "viem"

const ADMIN_ABI = parseAbi([
  "function pause() external",
  "function unpause() external",
  "function setMintPrice(uint256 _price) external",
  "function withdraw() external",
  "function setBaseURI(string memory _baseURI) external",
])

export default function ContractManagement() {
  const { write: pause } = useContractWrite({
    address: process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`,
    abi: ADMIN_ABI,
    functionName: "pause",
  })

  const { write: unpause } = useContractWrite({
    address: process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`,
    abi: ADMIN_ABI,
    functionName: "unpause",
  })

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">合约管理</h1>
      
      <div className="space-y-4">
        <button onClick={() => pause?.()} className="bg-red-500 text-white px-4 py-2 rounded">
          暂停铸造
        </button>
        <button onClick={() => unpause?.()} className="bg-green-500 text-white px-4 py-2 rounded">
          恢复铸造
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          提取资金
        </button>
      </div>
    </div>
  )
}
```

### 5.4 Phase 3 交付物清单

- [ ] `app/admin/page.tsx` Admin Dashboard
- [ ] `app/admin/whitelist/page.tsx` 白名单管理
- [ ] `app/admin/contract/page.tsx` 合约管理
- [ ] 数据看板（铸造趋势、Gas 分析）
- [ ] 品牌设计稿替换（favicon、logo、OG 图片）

---

## 六、安全与最佳实践

### 6.1 安全措施

**6.1.1 前端安全**
- RPC 网关强制鉴权（Service Token），防止泄露后产生高额账单
- CSP（Content Security Policy）头配置，防止 XSS
- 所有用户输入进行 Zod 验证
- IPFS 图片加载失败自动降级，防止单点故障

**6.1.2 合约安全**
- 使用 OpenZeppelin 标准 ERC721 实现
- 启用 Pausable 机制，紧急情况可暂停铸造
- Ownable 权限控制，仅 Owner 可调用管理函数
- ReentrancyGuard 防止重入攻击
- 白名单 Merkle Root 可更新，但需记录历史版本（审计追踪）

**6.1.3 API 安全**
- 白名单 API 启用 Rate Limiting（Cloudflare 边缘限流）
- CORS 仅允许 `nft.cinachain.com` 跨域调用
- KV 数据加密存储（敏感字段）

### 6.2 性能优化

**6.2.1 前端性能**
- Next.js 自动代码分割
- 图片懒加载（`loading="lazy"`）
- IPFS 图片使用 WebP 格式（Cloudflare 自动转换）
- RPC 请求批处理（`batch: true`）
- 合约数据缓存（React Query `staleTime: 5min`）

**6.2.2 后端性能**
- Cloudflare Workers 边缘部署，低延迟
- KV 缓存白名单数据，避免重复计算 Merkle Tree
- D1 数据库连接池优化
- API 响应压缩（Brotli）

### 6.3 可维护性

**6.3.1 代码规范**
- TypeScript 严格模式（`"strict": true`）
- ESLint + Prettier 统一代码风格
- Husky + lint-staged 提交前检查
- Conventional Commits 规范提交信息

**6.3.2 文档**
- README.md 项目介绍、快速启动
- 每个模块添加 JSDoc 注释
- API 接口文档（Swagger/OpenAPI）
- 部署文档（Cloudflare 配置步骤）

---

## 七、成本估算

### 7.1 Cloudflare 费用（Pro 计划）

| 服务 | 免费额度 | 超出费用 | 月预估成本 |
|------|----------|----------|------------|
| Pages | 无限请求 | 免费 | $0 |
| Workers | 10 万请求/天 | $0.50/百万请求 | $0-5 |
| KV | 10 万读/天，1000 写/天 | $0.50/10 万读 | $0-2 |
| R2 | 10GB 存储，100 万读/月 | $0.02/GB/月 | $0-1 |
| IPFS Gateway | 50GB/月 | $0.05/GB | $0-10 |
| RPC Gateway | 50 万请求/月 | $0.50/万请求 | $0-5 |
| **总计** | | | **$20-30/月** |

### 7.2 其他费用

| 服务 | 费用 |
|------|------|
| NFT.Storage（IPFS Pin） | 免费（Filecoin 网络） |
| WalletConnect | 免费（基础版） |
| GitHub Actions | 免费（公开仓库） |
| 域名 cinachain.com | ~$10/年 |
| **总计** | **~$30-40/月** |

---

## 八、风险与缓解

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Cloudflare Pages 不支持某些 Node.js API | 构建失败 | 使用 `@cloudflare/next-on-pages` 兼容层，提前测试 |
| IPFS 网关不可用 | NFT 图片无法加载 | 多网关降级（主 + 2 个备用） |
| RPC 网关限流 | 用户交互受阻 | 本地缓存 + 请求批处理 + 备用公共 RPC |
| 合约漏洞 | 资金损失 | 使用 OpenZeppelin 标准实现，第三方审计 |

### 8.2 运营风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 白名单数据丢失 | 用户无法铸造 | KV + D1 双备份，定期导出 CSV |
| 私钥泄露 | 合约被恶意操作 | 使用多签钱包（Gnosis Safe）管理合约 |
| Gas 价格暴涨 | 用户铸造成本高 | 监控 Gas 价格，提供 Gas 估算，建议用户选择低峰期 |

---

## 九、后续优化（Phase 4+）

- **The Graph 集成**：索引链上事件，提供高性能查询（持仓、历史）
- **多链支持**：扩展至 Polygon、Arbitrum 等 L2
- **社交功能**：NFT 展示墙、用户个人资料页
- **市场分析**：地板价、交易量、持有者分布
- **移动端 App**：React Native + WalletConnect

---

## 十、附录

### 10.1 关键文件路径

| 文件 | 用途 |
|------|------|
| `config/site.ts` | 站点配置（品牌、链接） |
| `config/networks.ts` | 链 & RPC 配置 |
| `lib/ipfs.ts` | IPFS 工具库 |
| `lib/contracts/cina-nft.ts` | NFT 合约交互封装 |
| `components/CinaNftImage.tsx` | NFT 图片组件 |
| `workers/whitelist/` | 白名单 API 项目 |

### 10.2 环境变量清单

| 变量 | 类型 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_CF_IPFS_GATEWAY` | Public | IPFS 网关地址 |
| `NEXT_PUBLIC_CF_RPC_ENDPOINT` | Public | RPC 网关地址 |
| `CF_RPC_SERVICE_AUTH_TOKEN` | Secret | RPC 鉴权 Token |
| `NEXT_PUBLIC_CINA_NFT_CONTRACT` | Public | NFT 合约地址 |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Public | WalletConnect Project ID |
| `NEXT_PUBLIC_SITE_URL` | Public | 站点 URL |
| `NEXTAUTH_SECRET` | Secret | SIWE 签名密钥 |

### 10.3 部署检查清单

- [ ] 所有环境变量已配置（Cloudflare Pages + Workers）
- [ ] KV 命名空间已创建，白名单数据已初始化
- [ ] NFT 合约已部署，地址已填入环境变量
- [ ] IPFS 素材已上传至 NFT.Storage
- [ ] RPC 网关已启用，Service Token 已生成
- [ ] 域名 DNS 已配置（nft.cinachain.com → CF Pages）
- [ ] SSL 证书已自动签发（Cloudflare 自动）
- [ ] CI/CD 已配置（GitHub Actions 自动部署）

---

**文档版本**: v1.0  
**最后更新**: 2026-06-20  
**作者**: ZCode Agent  
**审核状态**: 待用户审阅
