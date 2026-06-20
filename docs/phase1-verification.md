# Phase 1 部署验证文档

## 部署前检查清单

### 1. 环境变量配置

**Cloudflare Pages 后台：**

- [ ] `NEXT_PUBLIC_CF_IPFS_GATEWAY` = `https://ipfs.cinachain.com`
- [ ] `NEXT_PUBLIC_CF_RPC_ENDPOINT` = `https://rpc.cinachain.com/v1`
- [ ] `CF_RPC_SERVICE_AUTH_TOKEN` = (加密)
- [ ] `NEXT_PUBLIC_CINA_NFT_CONTRACT` = `0xYourContractAddress`
- [ ] `NEXT_PUBLIC_WC_PROJECT_ID` = `your-wc-project-id`
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://nft.cinachain.com`
- [ ] `NEXTAUTH_SECRET` = (加密，至少 32 字符)

**GitHub Secrets：**

- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `NEXT_PUBLIC_WC_PROJECT_ID`
- [ ] 所有 Pages 环境变量（通过 GitHub Variables 或 Secrets）

### 2. Cloudflare 服务配置

- [ ] Pages 项目已创建，域名 `nft.cinachain.com` 已绑定
- [ ] IPFS Gateway `ipfs.cinachain.com` 已启用
- [ ] RPC Gateway `rpc.cinachain.com` 已启用，Service Token 已生成
- [ ] KV 命名空间 `CINA_WHITELIST_KV` 已创建（如需白名单功能）

### 3. 合约准备

- [ ] NFT 合约已部署到以太坊主网
- [ ] 合约地址已填入 `NEXT_PUBLIC_CINA_NFT_CONTRACT`
- [ ] 合约已验证（Etherscan）

## 部署后验证

### 1. 品牌验证

```bash
# 检查是否还有 TurboETH 字样
curl -s https://nft.cinachain.com | grep -i "turboeth"
# 预期：无输出

# 检查页面标题
curl -s https://nft.cinachain.com | grep -o "<title>.*</title>"
# 预期：CinaChain
```

### 2. 功能验证

| 验证项 | 测试步骤 | 预期结果 |
|--------|----------|----------|
| 首页加载 | 访问 `https://nft.cinachain.com` | 页面正常渲染，无错误 |
| NFT 展示页 | 访问 `https://nft.cinachain.com/explore` | 显示 NFT 列表或 "No NFTs minted yet" |
| 钱包连接 | 点击 "Connect Wallet" | RainbowKit 弹窗显示 "CinaChain" |
| RPC 请求 | 打开 DevTools Network 面板 | 合约调用走 `rpc.cinachain.com` |
| IPFS 图片 | 检查 NFT 图片加载 | 图片从 `ipfs.cinachain.com` 加载 |

### 3. 白名单 API 测试

```bash
# 测试白名单 API（替换为你的测试地址）
curl https://api.cinachain.com/whitelist/0xYourTestAddress

# 预期响应（如果地址在白名单中）
# {
#   "eligible": true,
#   "proof": ["0x...", "0x..."],
#   "merkleRoot": "0x...",
#   "mintLimit": 3
# }
```

### 4. 性能验证

- [ ] Lighthouse 评分 > 90（Performance）
- [ ] 首次内容绘制（FCP）< 2s
- [ ] 最大内容绘制（LCP）< 2.5s

## 冒烟测试脚本

创建 `scripts/smoke-test.sh`：

```bash
#!/bin/bash

set -e

echo "🔍 Running smoke tests..."

# 1. 检查首页
echo "Checking homepage..."
curl -s -o /dev/null -w "%{http_code}" https://nft.cinachain.com | grep -q "200"
echo "✅ Homepage OK"

# 2. 检查 NFT 展示页
echo "Checking explore page..."
curl -s -o /dev/null -w "%{http_code}" https://nft.cinachain.com/explore | grep -q "200"
echo "✅ Explore page OK"

# 3. 检查品牌
echo "Checking branding..."
curl -s https://nft.cinachain.com | grep -qi "cinachain"
echo "✅ Branding OK"

echo "✅ All smoke tests passed!"
```

运行：

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

## 问题排查

### IPFS 图片无法加载

1. 检查 `NEXT_PUBLIC_CF_IPFS_GATEWAY` 是否正确
2. 检查 IPFS Gateway 是否在 Cloudflare 后台启用
3. 检查 NFT 素材是否已上传到 NFT.Storage

### RPC 调用失败

1. 检查 `CF_RPC_SERVICE_AUTH_TOKEN` 是否正确
2. 检查 RPC Gateway 是否在 Cloudflare 后台启用
3. 检查合约地址是否正确

### 白名单 API 返回 500

1. 检查 KV 命名空间是否已创建并绑定
2. 检查白名单数据是否已写入 KV
3. 查看 Workers 日志：`wrangler tail`

### Cloudflare Pages 构建失败

1. 检查环境变量是否在 Pages 后台配置
2. 检查 `pnpm pages:build` 本地是否能成功
3. 查看构建日志：Cloudflare Pages Dashboard → Builds

## 后续步骤

Phase 1 验证通过后，进入 Phase 2：

- 铸造页面开发（`/mint`）
- 用户 Dashboard（`/dashboard`）
- 代码瘦身（移除不需要的集成模块）
- NFT 详情页（`/collection/[id]`）

## 参考文档

- [Phase 1 设计文档](./superpowers/specs/2026-06-20-cinachain-production-deployment-design.md)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Web3 Gateways](https://developers.cloudflare.com/web3/)
