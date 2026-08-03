# CinaNFT 合约部署指南

## 前置要求

### 1. 安装 Foundry

```bash
# macOS / Linux
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Windows (在 Git Bash 中运行)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

验证安装：
```bash
forge --version
```

### 2. 获取测试 ETH

前往 Sepolia Faucet 获取测试 ETH：
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://infura.io/faucet/sepolia

需要至少 **0.1 ETH** 用于部署 gas。

### 3. 获取 Etherscan API Key

前往 https://etherscan.io/myapikey 创建免费 API Key（用于合约验证）。

---

## 部署步骤

### Step 1: 安装依赖

```bash
cd contracts

# 安装 OpenZeppelin 合约
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 安装 forge-std（测试库，通常已自动包含）
forge install foundry-rs/forge-std --no-commit
```

### Step 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入你的私钥和 RPC URL
# PRIVATE_KEY=0x...（你的钱包私钥）
# SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
# ETHERSCAN_API_KEY=...
```

### Step 3: 编译合约

```bash
forge build
```

### Step 4: 运行测试

```bash
forge test -vvv
```

所有测试应该通过 ✅

### Step 5: 部署到 Sepolia

```bash
# 加载环境变量
source .env

# 部署合约
forge script script/DeployCinaNFT.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvv
```

部署成功后，终端会输出合约地址，例如：
```
CinaNFT deployed at: 0x1234...abcd

=== Add to .env.local ===
NEXT_PUBLIC_CINA_NFT_CONTRACT=0x1234...abcd
==========================
```

### Step 6: 更新 DApp 配置

将合约地址添加到项目根目录的 `.env.local`：

```bash
# 在项目根目录 (E:\cinagroup\cinachain)
NEXT_PUBLIC_CINA_NFT_CONTRACT=0x你的合约地址
```

重新构建并部署：
```bash
npm run build
npx wrangler pages deploy out --project-name=cinachain-nft-dapp --commit-dirty=true
```

---

## 部署后配置

### 设置白名单 Merkle Root（可选）

如果需要白名单铸造功能：

1. 生成 Merkle Root（使用 JavaScript）：
```javascript
const { MerkleTree } = require("merkletreejs")
const { keccak256, abi } = require("viem")

const addresses = [
  "0xAddress1",
  "0xAddress2",
  // ...
]

const leaves = addresses.map(addr => keccak256(abi.encodePacked(addr)))
const tree = new MerkleTree(leaves, keccak256)
const root = tree.getHexRoot()

console.log("Merkle Root:", root)
```

2. 通过 Admin 面板或 Etherscan 设置：
   - 前往 `https://sepolia.etherscan.io/address/你的合约#writeContract`
   - 连接 Owner 钱包
   - 调用 `setMerkleRoot` 函数

### 设置 IPFS BaseURI（可选）

如果要使用 IPFS 元数据替代链上生成的元数据：

1. 上传 NFT 图片和元数据 JSON 到 IPFS（Pinata / NFT.Storage）
2. 获取 CID（如 `QmXYZ...`）
3. 通过 Admin 面板调用 `setBaseURI("ipfs://QmXYZ.../")`

---

## 合约功能总结

| 功能 | 函数 | 访问控制 | 费用 |
|------|------|---------|------|
| 公共铸造 | `mintPublic(quantity)` | 所有人（未暂停时） | 0.05 ETH/个 |
| 白名单铸造 | `mintWhitelist(proof, quantity)` | 白名单地址 | **免费** |
| 暂停 | `pause()` | Owner | - |
| 恢复 | `unpause()` | Owner | - |
| 提现 | `withdraw()` | Owner | - |
| 改价 | `setMintPrice(wei)` | Owner | - |
| 改 URI | `setBaseURI(uri)` | Owner | - |
| 改白名单 | `setMerkleRoot(root)` | Owner | - |

### 限制
- 最大供应量: **10,000**
- 每地址公共铸造上限: **10 个**
- 每地址白名单铸造上限: **3 个**

---

## 验证部署

部署完成后，在 DApp 上验证：

1. **Mint 页面** (`/mint`)：连接钱包 → 公共铸造 1 个 NFT（需要 0.05 测试 ETH）
2. **Dashboard** (`/dashboard`)：查看持有的 NFT 数量
3. **My NFTs** (`/dashboard/nfts`)：查看 NFT 卡片和元数据
4. **Explore** (`/explore`)：浏览已铸造的 NFT
5. **Admin** (`/admin/contract`)：Owner 可暂停/提现/改价
6. **Etherscan**：在 `https://sepolia.etherscan.io/address/你的合约` 查看交易记录
