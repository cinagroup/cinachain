# CinaNFT 合约部署指南 — Base Sepolia Testnet

## 网络

CinaChain DApp 当前运行在 **Base Sepolia Testnet**（Base L2 的测试网络）上，用于在主网上线前验证合约与交易流程。

| 网络 | Chain ID | RPC | 浏览器 |
|------|---------|-----|--------|
| **Base Mainnet** | 8453 | `https://mainnet.base.org` | [basescan.org](https://basescan.org) |
| **Base Sepolia** (测试网) | 84532 | `https://sepolia.base.org` | [sepolia.basescan.org](https://sepolia.basescan.org) |

---

## 前置要求

### 1. 安装 Foundry

```bash
# macOS / Linux / Windows(Git Bash)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

验证：`forge --version`

### 2. 获取测试 ETH（Base Sepolia）

你需要 **Base 上的 ETH**（不是以太坊主网 ETH）。获取方式：

- **从 Coinbase 交易所提取**：直接提现到 Base 网络（免费）
- **跨链桥**：使用 [bridge.base.org](https://bridge.base.org)
- **Base Sepolia Faucet**：[faucet.quicknode.com/base/sepolia](https://faucet.quicknode.com/base/sepolia)

至少需要 **0.01 ETH** 用于部署 gas。

### 3. 获取 Basescan API Key

前往 [basescan.org/myapikey](https://basescan.org/myapikey) 创建免费 API Key。

---

## 部署步骤

### Step 1: 安装依赖

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

### Step 2: 配置环境

```bash
cp .env.example .env
# 编辑 .env：
#   PRIVATE_KEY=0x你的私钥
#   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
#   BASESCAN_API_KEY=你的key
```

### Step 3: 编译 + 测试

```bash
forge build
forge test -vvv
```

### Step 4: 部署到 Base Sepolia（测试网）

```bash
source .env

forge script script/DeployCinaNFT.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvv
```

部署成功后输出：
```
CinaNFT deployed at: 0x...

=== Add to .env.local ===
NEXT_PUBLIC_CINA_NFT_CONTRACT=0x...
==========================
```

### Step 5: 部署到 Base Mainnet（生产环境）

测试验证通过后，部署到主网：

```bash
source .env

forge script script/DeployCinaNFT.s.sol \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvv
```

### Step 6: 更新 DApp 配置

将合约地址写入项目根目录的 `.env.local`：
```bash
NEXT_PUBLIC_CINA_NFT_CONTRACT=0x你的合约地址
```

重新构建并部署 DApp：
```bash
npm run build
CLOUDFLARE_API_TOKEN=your_token npx wrangler pages deploy out --project-name=cinachain-nft-dapp --commit-dirty=true
```

---

## 合约功能

| 功能 | 函数 | 费用 | 上限 |
|------|------|------|------|
| 公共铸造 | `mintPublic(quantity)` | 0.001 ETH/个 | 10 个/地址 |
| 白名单铸造 | `mintWhitelist(proof, qty)` | **免费** | 3 个/地址 |
| 最大供应 | — | — | 10,000 |

### 管理员功能（仅 Owner）
- `pause()` / `unpause()` — 紧急暂停/恢复
- `withdraw()` — 提取合约内所有 ETH
- `setMintPrice(wei)` — 更新铸造价格
- `setBaseURI(uri)` — 设置 IPFS 元数据 URI
- `setMerkleRoot(root)` — 设置白名单 Merkle Root

---

## Base L2 优势

| 对比项 | Ethereum 主网 | Base L2 |
|--------|-------------|---------|
| 单次铸造 Gas | $15-50 | **$0.01-0.10** |
| 批量铸造 10 个 | $50-200 | **$0.05-0.50** |
| 区块时间 | 12 秒 | **2 秒** |
| 最终确认 | 即时 | ~7 天（提现到 L1） |
| WalletConnect | ✅ | ✅ |
| OpenSea 支持 | ✅ | ✅ |

---

## 验证部署

部署完成后验证端到端流程：

1. **Mint** (`/mint`)：连接钱包 → 铸造 1 个 NFT（0.001 ETH）
2. **Dashboard** (`/dashboard`)：查看持有数量
3. **My NFTs** (`/dashboard/nfts`)：查看 NFT 卡片
4. **Explore** (`/explore`)：浏览已铸造 NFT
5. **Admin** (`/admin/contract`)：暂停/提现/改价
6. **Basescan**：`https://basescan.org/address/你的合约`
