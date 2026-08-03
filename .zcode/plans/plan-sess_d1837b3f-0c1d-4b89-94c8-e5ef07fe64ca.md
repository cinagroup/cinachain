# cinachain.com 集团门户首页方案

## 定位
替换当前 `nft.cinachain.com` 首页（`app/(general)/page.tsx`），从 NFT 营销页升级为 **CinaChain 集团门户首页**，展示完整生态系统。现有 Mint/Explore/Dashboard 等子页面保持不变。

## 页面结构（单页滚动）

### 1. Hero Section
- CinaChain 品牌标识 + 标语："Building the Future on Base"
- CTA: "Explore NFT DApp" → /explore, "View Dashboard" → /dashboard
- 实时链上数据条（已部署的合约 stats）

### 2. 产品矩阵（Product Showcase）
4 个产品卡片网格：
- **CinaChain NFT** — ERC-721 NFT 平台（链接 /explore）
- **CinaBadge** — ERC-1155 成就徽章系统（链接 /dashboard/badges）
- **CinaWallet** — Coinbase Smart Wallet 集成（⚡ Gasless 交易）
- **CinaChain API** — Cloudflare Workers 边缘 API

### 3. 技术生态（Tech Stack）
4 个技术标签卡片：
- Base L2（100x 更低 gas）
- IPFS（去中心化存储 + 多网关回退）
- Coinbase Smart Wallet（Passkey 无种子短语）
- Cloudflare（边缘部署 + Workers）

### 4. 路线图（Roadmap）
水平时间线，4 个阶段：
- ✅ Phase 1: 基础设施（已完成）
- ✅ Phase 2: NFT 平台 + 合约部署（已完成）
- ✅ Phase 3: 管理后台 + 徽章系统（已完成）
- 🚀 Phase 4: Gasless 交易 + 多产品生态（进行中）

### 5. 团队介绍（Team）
简洁的团队展示（3-4 个占位卡片，用户后续填充真实信息）

### 6. Footer CTA
- 社区链接（Discord、GitHub、X/Twitter）
- "Built on Base" 标识

## 技术实现
- 复用现有 Vercel 设计系统（font-display、shadow-vercel-card、btn-pill）
- 复用 `useContractStats` 显示实时数据
- 保留 Mint/Explore/Dashboard 的导航入口
- 响应式设计（移动端单列、桌面端网格）
- 零新依赖 — 纯 React + Tailwind + lucide-react 图标

## 文件修改
- `app/(general)/page.tsx` — 完全重写首页内容
- 保留所有子页面路由不变