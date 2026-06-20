# CinaChain NFT DApp - 部署指南

## 快速开始

### 1. 本地测试

```bash
# 安装依赖（确保网络正常）
pnpm install

# 本地开发（热重载）
pnpm dev

# 打开浏览器访问
http://localhost:3000
```

### 2. 环境变量配置

复制 `.env.example` 为 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

**必须配置的变量：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_CF_IPFS_GATEWAY` | IPFS 网关 | `https://ipfs.cinachain.com` |
| `NEXT_PUBLIC_CF_RPC_ENDPOINT` | RPC 网关 | `https://rpc.cinachain.com/v1` |
| `CF_RPC_SERVICE_AUTH_TOKEN` | RPC 鉴权 Token | `your-token-here` |
| `NEXT_PUBLIC_CINA_NFT_CONTRACT` | NFT 合约地址 | `0x...` |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect Project ID | `your-project-id` |
| `NEXT_PUBLIC_APP_ADMINS` | 管理员地址（逗号分隔） | `0x123,0x456` |

### 3. Cloudflare Pages 部署

#### 方法 A：GitHub Actions（推荐）

1. Fork 仓库到 `cinagroup/cinachain`
2. 在 GitHub 仓库设置中添加 Secrets：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `NEXT_PUBLIC_WC_PROJECT_ID`
3. 在 Cloudflare Pages 后台添加环境变量（Variables）：
   - `NEXT_PUBLIC_CF_IPFS_GATEWAY`
   - `NEXT_PUBLIC_CF_RPC_ENDPOINT`
   - `NEXT_PUBLIC_CINA_NFT_CONTRACT`
4. 推送代码到 `main` 分支触发自动部署

```bash
git checkout main
git merge feat/phase1-nft-dapp
git push origin main
```

#### 方法 B：手动部署

```bash
# 构建 Cloudflare Pages 产物
pnpm pages:build

# 本地预览
pnpm pages:preview

# 部署到 Cloudflare Pages
pnpm pages:deploy
```

### 4. 白名单 API 部署

```bash
cd workers/whitelist

# 安装依赖
pnpm install

# 创建 KV 命名空间
wrangler kv:namespace create "CINA_WHITELIST_KV"

# 更新 wrangler.toml 中的 KV ID

# 部署 Workers
pnpm deploy

# 写入白名单数据
wrangler kv:key put --binding CINA_WHITELIST_KV "whitelist:current" '{
  "merkleRoot": "0x...",
  "addresses": ["0x123...", "0x456..."],
  "mintLimit": 3
}'
```

### 5. 合约部署

**前置要求：**
- 部署 ERC721 合约（OpenZeppelin 标准）
- 合约需包含以下函数：
  - `totalSupply()`
  - `tokenURI(uint256)`
  - `ownerOf(uint256)`
  - `balanceOf(address)`
  - `mintWhitelist(bytes32[], uint256)`
  - `mintPublic(uint256)` (payable)
  - `pause()` / `unpause()`
  - `withdraw()`
  - `maxSupply()`
  - `mintPrice()`

**部署后：**
1. 将合约地址填入 `NEXT_PUBLIC_CINA_NFT_CONTRACT`
2. 在 Etherscan 验证合约
3. 更新 Merkle Root（通过 Admin Dashboard 或合约直接调用）

### 6. 测试清单

#### 功能测试

- [ ] 首页加载正常
- [ ] `/explore` 显示 NFT 列表
- [ ] `/mint` 铸造页面正常
- [ ] `/collection/[id]` NFT 详情页
- [ ] `/dashboard` 用户仪表板
- [ ] `/admin` 管理后台（需管理员钱包）
- [ ] 钱包连接（RainbowKit）
- [ ] IPFS 图片加载
- [ ] RPC 请求走 Cloudflare 网关

#### 合约交互测试

- [ ] 白名单铸造
- [ ] 公开铸造
- [ ] 暂停/恢复铸造
- [ ] 提取资金

#### 性能测试

- [ ] Lighthouse 评分 > 90
- [ ] FCP < 2s
- [ ] LCP < 2.5s

### 7. 常见问题

**Q: pnpm install 失败**
```bash
# 尝试使用 npm
npm install

# 或删除 lockfile 重试
rm pnpm-lock.yaml
pnpm install
```

**Q: TypeScript 报错**
```bash
pnpm tsc --noEmit
```

**Q: 构建失败**
```bash
# 检查环境变量
pnpm pages:build

# 查看错误日志
```

**Q: IPFS 图片无法加载**
- 检查 `NEXT_PUBLIC_CF_IPFS_GATEWAY` 配置
- 确认 NFT 素材已上传到 IPFS
- 检查浏览器 Network 面板

**Q: RPC 调用失败**
- 检查 `CF_RPC_SERVICE_AUTH_TOKEN` 是否正确
- 确认 RPC Gateway 在 Cloudflare 后台启用
- 检查合约地址是否正确

### 8. 生产检查清单

部署前确认：

- [ ] 所有环境变量已配置
- [ ] NFT 合约已部署并验证
- [ ] IPFS 素材已上传（NFT.Storage）
- [ ] 白名单数据已准备（CSV 格式）
- [ ] KV 命名空间已创建
- [ ] Cloudflare 域名已绑定
- [ ] SSL 证书自动签发
- [ ] CI/CD 已配置
- [ ] 管理员钱包地址已配置
- [ ] 监控告警已设置（Cloudflare 用量）

### 9. 监控与维护

**Cloudflare Dashboard:**
- 查看 Pages 访问日志
- 监控 Workers 请求量
- 检查 KV 读写次数
- 设置用量告警阈值

**定期维护:**
- 每周检查 IPFS 网关可用性
- 每月审查白名单数据
- 监控合约 Gas 消耗
- 备份 R2 存储数据

---

**文档版本**: v1.0  
**更新日期**: 2026-06-20  
**维护者**: cinagroup
