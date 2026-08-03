# CinaChain NFT 智能合约部署方案

## 网络与工具
- **网络**: Sepolia 测试网
- **工具**: Foundry (Forge)
- **合约标准**: OpenZeppelin ERC721Enumerable + Pausable + Ownable + MerkleProof

## 合约设计决策
- 白名单铸造：**免费** (`mintWhitelist` nonpayable)
- 公共铸造：**付费 0.05 ETH** (`mintPublic` payable)
- 最大供应量: **10,000**
- 元数据: 链上生成（`tokenURI` 返回 base64 编码的 JSON，包含 tokenId + name），后续可通过 `setBaseURI` 切换到 IPFS
- 访问控制: OpenZeppelin `Ownable`（owner = 部署者 = `0x9D81...8eED`）

## 实现步骤

### 第 1 步：创建 Foundry 项目结构
在项目根目录创建 `contracts/` 子目录：
```
contracts/
├── foundry.toml              # Foundry 配置
├── src/
│   ├── CinaNFT.sol           # ERC-721 主合约
│   └── CinaBatch.sol         # ERC-1155 批量合约（可选，后续部署）
├── script/
│   └── DeployCinaNFT.s.sol   # 部署脚本
├── test/
│   └── CinaNFT.t.sol         # 单元测试
└── .env.example              # 环境变量模板
```

### 第 2 步：编写 CinaNFT.sol 合约
基于 OpenZeppelin，实现：
- **继承**: ERC721Enumerable, Ownable, Pausable
- **状态变量**: `mintPrice` (0.05 ETH), `maxSupply` (10000), `merkleRoot`, `baseTokenURI`, `_mintedPerAddress` mapping
- **铸造函数**:
  - `mintPublic(uint256 quantity)` payable — 检查 paused + 价格 + maxSupply + 每地址上限(10)
  - `mintWhitelist(bytes32[] proof, uint256 quantity)` nonpayable — 检查 paused + Merkle proof + 每地址上限
- **管理员函数**: pause, unpause, withdraw, setMintPrice, setBaseURI, setMerkleRoot
- **链上元数据**: `tokenURI()` 返回 base64 编码 JSON（name/description/image placeholder），当 `baseTokenURI` 为空时使用

### 第 3 步：编写部署脚本
`DeployCinaNFT.s.sol`:
- 构造函数参数: name, symbol, maxSupply, mintPrice
- 使用 `vm.startBroadcast()` + 私钥签名
- 部署后输出合约地址

### 第 4 步：安装 Foundry + OpenZeppelin
```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 在 contracts/ 目录初始化
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

### 第 5 步：编译 + 测试
```bash
forge build
forge test
```

### 第 6 步：部署到 Sepolia
```bash
# 需要 Sepolia RPC URL + 钱包私钥 + 测试 ETH
forge script script/DeployCinaNFT.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### 第 7 步：更新 DApp 配置
部署成功后：
1. 将合约地址写入 `.env.local`:
   ```
   NEXT_PUBLIC_CINA_NFT_CONTRACT=0x<部署后的地址>
   ```
2. 重新构建 + 部署 Cloudflare Pages
3. 在 Etherscan Sepolia 验证合约

### 第 8 步：验证端到端流程
1. 在 mint 页面连接钱包
2. 测试公共铸造（发送 0.05 ETH）
3. 在 Dashboard 查看持有的 NFT
4. 在 Explore 页面查看 NFT 图片
5. 测试 Admin 页面（pause/withdraw/setMintPrice）

## 安全保障
- 使用 OpenZeppelin 审计过的基础合约
- `onlyOwner` 修饰所有管理员函数
- `Pausable` 紧急暂停
- ReentrancyGuard 防重入
- MerkleProof 白名单验证
- 提现使用 `.call` 而非 `.transfer`

## 前端 ABI 同步
合约部署后，同步更新：
- `lib/hooks/use-mint-contract.ts` — 将 `mintWhitelist` 从 payable 改为 nonpayable
- 确认 `lib/contracts/abi.ts` 完全匹配合约接口