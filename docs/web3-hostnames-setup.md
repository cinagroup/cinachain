# Cloudflare Web3 自定义 Hostnames 配置指南

## 命名方案

### IPFS DNSlink Gateways (3 个)
| 域名 | 用途 | 说明 |
|------|------|------|
| `ipfs.cinachain.com` | 主 IPFS 网关 | NFT 图片、元数据、静态资源 |
| `cdn.cinachain.com` | CDN 加速 | 公共 CDN 内容分发 |
| `meta.cinachain.com` | 元数据服务 | NFT metadata JSON、API 响应 |

### Ethereum Gateways (3 个)
| 域名 | 用途 | 链 |
|------|------|-----|
| `rpc.cinachain.com` | 主 RPC 端点 | Ethereum Mainnet |
| `mainnet-rpc.cinachain.com` | 以太坊主网专用 | Ethereum Mainnet |
| `base-rpc.cinachain.com` | Base 链专用 | Base Mainnet |

---

## Cloudflare Dashboard 配置步骤

### 1. IPFS DNSlink Gateways

**路径**: Cloudflare Dashboard → **Web3** → **IPFS Gateways**

#### Gateway 1: `ipfs.cinachain.com`
- **Hostname**: `ipfs.cinachain.com`
- **DNSlink**: 启用
- **Cache TTL**: 30 天 (2592000 秒)
- **CORS**: 允许 `https://nft.cinachain.com`
- **Rate Limiting**: 100 请求/分钟/IP
- **WAF**: 启用 Bot Fight Mode

#### Gateway 2: `cdn.cinachain.com`
- **Hostname**: `cdn.cinachain.com`
- **DNSlink**: 启用
- **Cache TTL**: 7 天 (604800 秒)
- **CORS**: 允许所有来源 `*`
- **Rate Limiting**: 200 请求/分钟/IP

#### Gateway 3: `meta.cinachain.com`
- **Hostname**: `meta.cinachain.com`
- **DNSlink**: 启用
- **Cache TTL**: 1 小时 (3600 秒) - 元数据更新频繁
- **CORS**: 允许 `https://nft.cinachain.com`
- **Rate Limiting**: 50 请求/分钟/IP

### 2. Ethereum Gateways

**路径**: Cloudflare Dashboard → **Web3** → **Ethereum Gateways**

#### Gateway 1: `rpc.cinachain.com` (已配置)
- **Hostname**: `rpc.cinachain.com`
- **Network**: Ethereum Mainnet
- **Authentication**: Service Token (已生成)
- **CORS**: `https://nft.cinachain.com`
- **Rate Limiting**: 100 请求/分钟/IP

#### Gateway 2: `mainnet-rpc.cinachain.com`
- **Hostname**: `mainnet-rpc.cinachain.com`
- **Network**: Ethereum Mainnet
- **Authentication**: Service Token (新建)
- **CORS**: `https://nft.cinachain.com`
- **Rate Limiting**: 100 请求/分钟/IP

#### Gateway 3: `base-rpc.cinachain.com`
- **Hostname**: `base-rpc.cinachain.com`
- **Network**: Base Mainnet
- **Authentication**: Service Token (新建)
- **CORS**: `https://nft.cinachain.com`
- **Rate Limiting**: 100 请求/分钟/IP

---

## DNS 配置

在 Cloudflare DNS 中添加 CNAME 记录：

```
ipfs.cinachain.com      CNAME  ipfs.cinachain.com.cdn.cloudflare.net     Proxied
cdn.cinachain.com       CNAME  cdn.cinachain.com.cdn.cloudflare.net      Proxied
meta.cinachain.com      CNAME  meta.cinachain.com.cdn.cloudflare.net     Proxied

rpc.cinachain.com       CNAME  rpc.cinachain.com.cdn.cloudflare.net      Proxied
mainnet-rpc.cinachain.com  CNAME  mainnet-rpc.cinachain.com.cdn.cloudflare.net  Proxied
base-rpc.cinachain.com  CNAME  base-rpc.cinachain.com.cdn.cloudflare.net Proxied
```

---

## 更新项目配置

### 1. 更新环境变量

```env
# IPFS Gateways
NEXT_PUBLIC_CF_IPFS_GATEWAY=https://ipfs.cinachain.com
NEXT_PUBLIC_CF_CDN_GATEWAY=https://cdn.cinachain.com
NEXT_PUBLIC_CF_META_GATEWAY=https://meta.cinachain.com

# Ethereum Gateways
NEXT_PUBLIC_CF_RPC_ENDPOINT=https://rpc.cinachain.com
NEXT_PUBLIC_MAINNET_RPC=https://mainnet-rpc.cinachain.com
NEXT_PUBLIC_BASE_RPC=https://base-rpc.cinachain.com

# Auth Tokens
CF_RPC_SERVICE_AUTH_TOKEN=your-mainnet-token
CF_BASE_RPC_SERVICE_AUTH_TOKEN=your-base-token
```

### 2. 更新 `config/networks.ts`

```typescript
import { http } from "wagmi"
import { mainnet, sepolia, base } from "wagmi/chains"

const rpcToken = process.env.CF_RPC_SERVICE_AUTH_TOKEN
const baseRpcToken = process.env.CF_BASE_RPC_SERVICE_AUTH_TOKEN

export const chains = [mainnet, sepolia, base] as const

export const transports = {
  [mainnet.id]: http(
    rpcToken 
      ? `${process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT}?token=${rpcToken}`
      : process.env.NEXT_PUBLIC_MAINNET_RPC || "https://ethereum.publicnode.com",
    { batch: false, timeout: 30000 }
  ),
  [sepolia.id]: http("https://rpc.sepolia.org"),
  [base.id]: http(
    baseRpcToken 
      ? `${process.env.NEXT_PUBLIC_BASE_RPC}?token=${baseRpcToken}`
      : "https://mainnet.base.org",
    { batch: false, timeout: 30000 }
  ),
} as const
```

### 3. 更新 `lib/ipfs.ts`

```typescript
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY || "https://ipfs.cinachain.com"
const CDN_GATEWAY = process.env.NEXT_PUBLIC_CF_CDN_GATEWAY || "https://cdn.cinachain.com"
const META_GATEWAY = process.env.NEXT_PUBLIC_CF_META_GATEWAY || "https://meta.cinachain.com"

export function ipfsToHttps(uri: string, type: "image" | "meta" = "image"): string {
  if (!uri.startsWith("ipfs://")) return uri
  const cid = uri.replace("ipfs://", "")
  const gateway = type === "meta" ? META_GATEWAY : IPFS_GATEWAY
  return `${gateway}/ipfs/${cid}`
}
```

### 4. 更新 `next.config.mjs`

```javascript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "ipfs.cinachain.com" },
    { protocol: "https", hostname: "cdn.cinachain.com" },
    { protocol: "https", hostname: "meta.cinachain.com" },
    { protocol: "https", hostname: "cloudflare-ipfs.com" },
    { protocol: "https", hostname: "ipfs.io" },
    { protocol: "https", hostname: "avatars.githubusercontent.com" },
  ],
},
```

---

## Cloudflare API 配置脚本

使用 Cloudflare API 自动创建 Hostnames：

```bash
#!/bin/bash

ACCOUNT_ID="7ea8e46d8210bad342fa7595f7935fea"
API_TOKEN="cfut_gSJPQNh3WWe0DXSBtjUp5cpAtBBw3atUPvXX4cqk9bc5a716"
ZONE_ID="363c240a200996181b6192bdb03e7ce4"

# 创建 IPFS DNSlink Gateway
create_ipfs_gateway() {
  local hostname=$1
  echo "Creating IPFS Gateway: $hostname"
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/web3/hostnames" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"hostname\": \"$hostname\",
      \"dnslink\": \"dnslink=/ipfs/QmYourCID\",
      \"cache_ttl\": 2592000,
      \"cors_headers\": {
        \"Access-Control-Allow-Origin\": \"https://nft.cinachain.com\"
      }
    }"
}

# 创建 Ethereum Gateway
create_eth_gateway() {
  local hostname=$1
  local network=$2
  echo "Creating Ethereum Gateway: $hostname ($network)"
  curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/web3/hostnames" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"hostname\": \"$hostname\",
      \"network\": \"$network\",
      \"auth\": {
        \"service_token\": true
      }
    }"
}

# 创建所有网关
create_ipfs_gateway "ipfs.cinachain.com"
create_ipfs_gateway "cdn.cinachain.com"
create_ipfs_gateway "meta.cinachain.com"

create_eth_gateway "mainnet-rpc.cinachain.com" "mainnet"
create_eth_gateway "base-rpc.cinachain.com" "base"

echo "✅ All Web3 Gateways created!"
```

---

## 验证步骤

### 1. 测试 IPFS Gateways

```bash
# 测试主 IPFS 网关
curl -I https://ipfs.cinachain.com/ipfs/QmYourCID
# 预期：HTTP 200 + CORS 头

# 测试 CDN 网关
curl -I https://cdn.cinachain.com/ipfs/QmYourCID

# 测试元数据网关
curl -I https://meta.cinachain.com/ipfs/QmYourCID
```

### 2. 测试 Ethereum Gateways

```bash
# 测试主 RPC
curl -X POST https://rpc.cinachain.com \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_TOKEN" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 测试 Base RPC
curl -X POST https://base-rpc.cinachain.com \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BASE_TOKEN" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 3. 验证 CORS

```bash
curl -X OPTIONS https://rpc.cinachain.com \
  -H "Origin: https://nft.cinachain.com" \
  -H "Access-Control-Request-Method: POST" \
  -I
# 预期：Access-Control-Allow-Origin: https://nft.cinachain.com
```

---

## 成本估算

| Gateway | 免费额度 | 超出费用 | 月预估 |
|---------|---------|---------|--------|
| IPFS (3 个) | 50GB/月/网关 | $0.05/GB | $0-5 |
| Ethereum (3 个) | 100K 请求/月/网关 | $0.50/万请求 | $0-10 |
| **总计** | | | **$0-15/月** |

---

## 下一步

1. **创建 Hostnames** - 使用 Dashboard 或 API 创建 6 个 Gateway
2. **生成 Service Tokens** - 为每个 Ethereum Gateway 生成 Token
3. **更新环境变量** - 在 Cloudflare Pages 后台添加新变量
4. **更新代码** - 应用上述配置更改
5. **测试验证** - 确保所有网关正常工作
6. **部署上线** - 推送到 GitHub 并部署
