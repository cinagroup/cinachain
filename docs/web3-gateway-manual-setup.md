# Cloudflare Web3 Gateway 配置指南（Dashboard 手动配置）

## 当前状态

✅ **已配置的 Gateway:**
- `rpc.cinachain.com` - Ethereum Gateway（已存在，状态：active）

❌ **待配置的 Gateway:**

### IPFS DNSlink Gateways (3 个)
| 域名 | 用途 | Cache TTL |
|------|------|-----------|
| `ipfs.cinachain.com` | 主 IPFS 网关（NFT 图片） | 30 天 |
| `cdn.cinachain.com` | CDN 加速（公共内容） | 7 天 |
| `meta.cinachain.com` | 元数据服务（JSON） | 1 小时 |

### Ethereum Gateways (2 个)
| 域名 | 用途 | 链 |
|------|------|-----|
| `mainnet-rpc.cinachain.com` | 以太坊主网专用 | Ethereum Mainnet |
| `base-rpc.cinachain.com` | Base 链专用 | Base Mainnet |

---

## 配置步骤

### 步骤 1：创建 DNS 记录

1. 登录 https://dash.cloudflare.com
2. 选择 **cinachain.com** 域名
3. 点击左侧 **DNS** → **Records**
4. 点击 **Add record**

**添加以下 CNAME 记录：**

| Type | Name | Target | TTL | Proxy status |
|------|------|--------|-----|--------------|
| CNAME | ipfs | `ipfs.cinachain.com.cdn.cloudflare.net` | Auto | Proxied |
| CNAME | cdn | `cdn.cinachain.com.cdn.cloudflare.net` | Auto | Proxied |
| CNAME | meta | `meta.cinachain.com.cdn.cloudflare.net` | Auto | Proxied |
| CNAME | mainnet-rpc | `mainnet-rpc.cinachain.com.cdn.cloudflare.net` | Auto | Proxied |
| CNAME | base-rpc | `base-rpc.cinachain.com.cdn.cloudflare.net` | Auto | Proxied |

**注意：** 如果 CNAME target 报错，尝试使用 A 记录指向 Cloudflare 的 IP 地址，或使用完整的域名格式。

### 步骤 2：配置 IPFS Gateways

1. 左侧菜单 → **Web3** → **IPFS Gateways**
2. 点击 **Create Gateway**
3. 填写：
   - **Hostname**: `ipfs.cinachain.com`
   - **DNSLink**: 留空或填写你的 IPFS CID
   - **Cache TTL**: 30 days
   - **CORS Headers**: 
     ```
     Access-Control-Allow-Origin: https://nft.cinachain.com
     ```
   - **Rate Limiting**: 100 requests/minute/IP
4. 点击 **Create**
5. 重复上述步骤创建 `cdn.cinachain.com` 和 `meta.cinachain.com`

### 步骤 3：配置 Ethereum Gateways

1. 左侧菜单 → **Web3** → **Ethereum Gateways**
2. 点击 **Create Gateway**
3. 填写：
   - **Hostname**: `mainnet-rpc.cinachain.com`
   - **Network**: Ethereum Mainnet
   - **Authentication**: Service Token（点击生成）
   - **CORS**: `https://nft.cinachain.com`
   - **Rate Limiting**: 100 requests/minute/IP
4. 点击 **Create**
5. **重要：** 复制生成的 Service Token，保存到安全位置
6. 重复创建 `base-rpc.cinachain.com`（选择 Base 网络）

### 步骤 4：生成 Service Tokens

为每个 Ethereum Gateway：
1. 在 Gateway 详情页点击 **Authentication** 标签
2. 点击 **Create Service Token**
3. 命名：`mainnet-rpc-token` 或 `base-rpc-token`
4. 复制 Token 并保存

### 步骤 5：更新项目环境变量

在 Cloudflare Pages Dashboard：
1. 选择 **cinachain-nft-dapp** 项目
2. Settings → **Environment variables**
3. 添加/更新以下变量：

**Production 环境变量：**

| 变量名 | 值 |
|--------|-----|
| `CF_RPC_SERVICE_AUTH_TOKEN` | `your-mainnet-service-token` |
| `CF_BASE_RPC_SERVICE_AUTH_TOKEN` | `your-base-service-token` |
| `NEXT_PUBLIC_CF_IPFS_GATEWAY` | `https://ipfs.cinachain.com` |
| `NEXT_PUBLIC_CF_CDN_GATEWAY` | `https://cdn.cinachain.com` |
| `NEXT_PUBLIC_CF_META_GATEWAY` | `https://meta.cinachain.com` |
| `NEXT_PUBLIC_MAINNET_RPC` | `https://mainnet-rpc.cinachain.com` |
| `NEXT_PUBLIC_BASE_RPC` | `https://base-rpc.cinachain.com` |

### 步骤 6：验证配置

```bash
# 测试 IPFS Gateway
curl -I https://ipfs.cinachain.com/ipfs/QmYourCID
# 预期：HTTP 200 + CORS 头

# 测试 Ethereum Gateway
curl -X POST https://mainnet-rpc.cinachain.com \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
# 预期：{"jsonrpc":"2.0","result":"0x...","id":1}

# 测试 Base Gateway
curl -X POST https://base-rpc.cinachain.com \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BASE_TOKEN" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
# 预期：{"jsonrpc":"2.0","result":"0x...","id":1}
```

### 步骤 7：测试 CORS

```bash
curl -X OPTIONS https://mainnet-rpc.cinachain.com \
  -H "Origin: https://nft.cinachain.com" \
  -H "Access-Control-Request-Method: POST" \
  -I
# 预期：
# Access-Control-Allow-Origin: https://nft.cinachain.com
# Access-Control-Allow-Methods: POST, OPTIONS
```

---

## 故障排除

### DNS 记录创建失败
- 确保域名在 Cloudflare 管理下
- 检查域名是否已激活（Status: Active）
- 尝试使用 A 记录代替 CNAME

### Web3 Gateway 创建失败
- 确认 API Token 有 Web3 编辑权限
- 检查 DNS 记录是否已存在
- 尝试使用 Dashboard 手动创建

### Service Token 不工作
- 确认 Token 已复制完整
- 检查 Token 权限
- 重新生成 Token

---

## 成本估算

| Gateway | 免费额度 | 超出费用 | 月预估 |
|---------|---------|---------|--------|
| IPFS (3 个) | 50GB/月/网关 | $0.05/GB | $0-5 |
| Ethereum (3 个) | 100K 请求/月/网关 | $0.50/万请求 | $0-10 |
| **总计** | | | **$0-15/月** |

---

## 下一步

1. ✅ 完成 Dashboard 配置
2. ✅ 生成 Service Tokens
3. ✅ 更新环境变量
4. ✅ 验证所有网关
5. ✅ 部署新版本
