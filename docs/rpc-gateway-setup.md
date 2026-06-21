# Cloudflare RPC Gateway 配置指南

## 问题分析
当前 `rpc.cinachain.com/v1` 返回 CORS 错误：
```
Access to fetch at 'https://rpc.cinachain.com/v1' from origin 'https://nft.cinachain.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

## 解决方案

### 方案 A：Cloudflare Dashboard 配置（推荐）

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 选择 `cinachain.com` 域名

2. **配置 Web3 Gateway**
   - 左侧菜单 → **Web3** → **Ethereum**
   - 点击 **Create** 创建新 Gateway
   - 配置如下：
     - **Name**: `rpc`
     - **Domain**: `rpc.cinachain.com`
     - **Network**: `Ethereum Mainnet`
     - **Authentication**: 启用并生成 Service Token
     - **Allowed Origins**: 添加 `https://nft.cinachain.com`
     - **Rate Limiting**: 建议设置为 100 requests/minute

3. **获取 Service Token**
   - 创建后，复制 Service Token
   - 格式：`eyJ...` (JWT token)

4. **更新环境变量**
   - Cloudflare Pages Dashboard → Settings → Environment variables
   - 添加/更新：
     ```
     CF_RPC_SERVICE_AUTH_TOKEN = eyJ... (你的 Service Token)
     NEXT_PUBLIC_CF_RPC_ENDPOINT = https://rpc.cinachain.com
     ```

5. **验证配置**
   ```bash
   # 测试 CORS 头
   curl -I https://rpc.cinachain.com/v1 \
     -H "Origin: https://nft.cinachain.com" \
     -H "Access-Control-Request-Method: POST"
   
   # 应该返回：
   # Access-Control-Allow-Origin: https://nft.cinachain.com
   ```

### 方案 B：Cloudflare Worker 代理（临时方案）

如果方案 A 无法立即配置，可以部署一个 Worker 作为 RPC 代理：

1. **创建 Worker**
   - Cloudflare Dashboard → **Workers & Pages** → **Create**
   - 选择 **Worker**
   - 命名为 `rpc-proxy`

2. **部署以下代码**
   ```javascript
   const UPSTREAM_RPC = 'https://eth.llamarpc.com'
   const ALLOWED_ORIGIN = 'https://nft.cinachain.com'

   export default {
     async fetch(request) {
       // CORS headers
       const headers = {
         'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
         'Access-Control-Allow-Methods': 'POST, OPTIONS',
         'Access-Control-Allow-Headers': 'Content-Type',
         'Content-Type': 'application/json',
       }

       // Handle preflight
       if (request.method === 'OPTIONS') {
         return new Response(null, { headers })
       }

       // Proxy request
       try {
         const response = await fetch(UPSTREAM_RPC, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: await request.text(),
         })

         return new Response(response.body, {
           status: response.status,
           headers,
         })
       } catch (error) {
         return new Response(JSON.stringify({ error: 'Proxy failed' }), {
           status: 500,
           headers,
         })
       }
     }
   }
   ```

3. **绑定域名**
   - Worker Settings → **Triggers** → **Add Custom Domain**
   - 输入 `rpc.cinachain.com`

4. **更新代码中的 RPC URL**
   - 修改 `config/networks.ts`：
     ```typescript
     const publicRpcUrl = "https://rpc.cinachain.com"  // Worker 代理
     ```

### 方案 C：使用公共 RPC（已实施）

当前代码已配置公共 RPC fallback：
```typescript
const publicRpcUrl = "https://eth.llamarpc.com"  // 支持 CORS
```

这个方案可以立即工作，无需额外配置。

## 推荐实施顺序

1. **立即生效**：方案 C 已部署，当前可用
2. **临时方案**：如果需要自定义域名，实施方案 B（10 分钟）
3. **长期方案**：实施方案 A（需要 Cloudflare Pro 计划 $20/月）

## 验证步骤

部署后，在浏览器控制台应不再出现：
```
Access to fetch at 'https://rpc.cinachain.com/v1' from origin 'https://nft.cinachain.com' 
has been blocked by CORS policy
```

RPC 请求应该成功返回区块链数据。