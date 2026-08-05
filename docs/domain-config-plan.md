# cinachain.com 域名配置规划

> 日期：2026-08-05 · 状态：规划（待执行）
> Zone：cinachain.com（Cloudflare）· Account：cinagroup

## 1. 现状盘点（2026-08-05）

| 域名 | 用途 | 现状 | 问题 |
|---|---|---|---|
| **nft.cinachain.com** | DApp 主站 | ⚠️ **DNS 无绑定**——Pages 项目 `cinachain-dapp-v2` 只在 `cinachain-dapp-v2.pages.dev` | **用户访问 nft.cinachain.com 拿不到应用**（最大缺口） |
| docs.cinachain.com | 文档 | 仅外链，无解析目标 | 未配置 |
| cinachain.com / www | 品牌根域 | 未使用 | 未配置 |
| ipfs / cdn / meta .cinachain.com | IPFS 网关（Web3 DNSLink） | CNAME → `<name>.cinachain.com.cdn.cloudflare.net`（Proxied） | 文档标 pending，需 dashboard 确认 |
| rpc.cinachain.com | ETH RPC 网关 | 文档标 active（CNAME + Service Token） | 前端未用（走公共 RPC），`config/networks.ts` 才是实际路径 |
| mainnet-rpc / base-rpc .cinachain.com | 主网 RPC 网关 | 未创建 | 低优先 |
| 5 × `*.cinagroup.workers.dev` | whitelist / billing / paymaster / mega-media / rpc-proxy | 全部裸 workers.dev | 无品牌域名；CSP 只放行了 whitelist 一个 workers.dev |
| mega.cinachain.com | CinaMega 媒体 | 不存在（worker-only） | 建议新增 |

**安全发现**：`docs/web3-hostnames-setup.md:179-181` 内嵌**活 API token**（`cfut_...`）——若仓库共享需轮换并清理。

## 2. 目标态命名体系

```
cinachain.com（品牌根域 → 门户/重定向）
├── 用户面
│   ├── nft.cinachain.com     DApp 主站（Pages cinachain-dapp-v2）★ 最高优先
│   ├── docs.cinachain.com    文档站（外部托管或 Pages 新项目）
│   └── www.cinachain.com     → 根域（301）
├── 服务面（worker 自定义域名，品牌化）
│   ├── whitelist-api.cinachain.com   ← cinachain-whitelist-api
│   ├── billing-api.cinachain.com     ← cinachain-billing
│   ├── paymaster-api.cinachain.com   ← cinachain-paymaster
│   ├── media.cinachain.com           ← cinachain-mega-media（CinaMega 媒体网关）
│   └── rpc-proxy.cinachain.com       ← rpc-proxy（若启用 Option B）
├── Web3 网关面（保留现状）
│   ├── ipfs.cinachain.com / cdn.cinachain.com / meta.cinachain.com   IPFS DNSLink
│   └── rpc.cinachain.com / mainnet-rpc.* / base-rpc.*                ETH RPC（低优先）
```

命名规则：`<service>-api.cinachain.com`（API 类）、`media.cinachain.com`（媒体）、`nft.cinachain.com`（产品主站）。

## 3. 实施步骤

### Phase 1 — dashboard 操作（需用户，Cloudflare dashboard / API）
1. **Pages 绑定**：`cinachain-dapp-v2` → 自定义域名 `nft.cinachain.com`（CNAME 自动创建）
2. **worker 自定义域名**（每个 worker：Settings → Triggers → Add Custom Domain）：
   `whitelist-api.cinachain.com` / `billing-api.cinachain.com` / `paymaster-api.cinachain.com` / `media.cinachain.com`
3. **docs.cinachain.com**：指向文档托管（GitHub Pages / Pages 新项目），未决定前可先 CNAME 到 placeholder
4. **根域**：`cinachain.com` CNAME → Pages（或 301 到 nft.cinachain.com，用 Pages 单页重定向）
5. 确认 ipfs/cdn/meta 三个 Web3 网关已生效（dashboard Web3 页签）

### Phase 2 — 代码配置（我来做）
| 文件 | 变更 |
|---|---|
| `.env.production` / `.env.local` | API 域名换品牌域名；`NEXT_PUBLIC_MEGA_MEDIA_URL=https://media.cinachain.com` |
| `public/_headers` CSP | connect-src 已含 `https://*.cinachain.com` 通配——**自定义域名绑定后自动覆盖全部服务**；删除 4 个 workers.dev 白名单（保留 whitelist 过渡期） |
| `public/sw.js` NO_CACHE_PATTERNS | `*.cinachain.com` 服务域名统一（保留 workers.dev 过渡期） |
| worker CORS allowlist | 已含 `https://nft.cinachain.com` ✓ 无需改 |
| `config/networks.ts` | （可选）`rpc.cinachain.com` 若启用 |
| 文档 | 更新 `docs/web3-hostnames-setup.md`（含**移除泄漏 token**） |

### Phase 3 — 可选增强
- `cinachain.com` 根域门户页（或 301 到 nft.cinachain.com）
- `docs.cinachain.com` 正式文档站
- `api.cinachain.com` 统一 API 网关（未来多 worker 收敛时）

## 4. 收益与风险

**收益**：
- 用户面域名闭环（nft.cinachain.com 可用）
- 服务品牌化（不再暴露 workers.dev）
- CSP 通配符 `*.cinachain.com` 覆盖所有服务（当前 billing/mega-media/paymaster 的 workers.dev **在 CSP 里是缺失的**——绑定自定义域名顺带修复）

**风险/注意**：
- worker 自定义域名绑定后，旧 workers.dev URL 仍可用（过渡兼容）；切换 env 后前端全部走新域名
- 绑定 nft.cinachain.com 前确认 Pages 项目生产分支 = main 且当前部署正常
- 根域/子域 CNAME 与 Web3 网关互不冲突（不同主机名）
- 泄漏 token 轮换前，勿在共享环境引用该文档

## 5. 待办
- [x] **Phase 1（2026-08-05 完成）**：nft.cinachain.com → Pages（已确认 active）；whitelist-api / billing-api / paymaster-api / media.cinachain.com → 4 worker（zone routes + proxied A 记录，全部健康 200）
- [x] **Phase 2（2026-08-05 完成）**：env/hooks/scripts/app 全部切品牌域名；CSP 依赖 `*.cinachain.com` 通配；sw.js NO_CACHE 更新；泄漏 token 已从文档移除（bbcdce5 + 07b25a0）
- [x] 验证：media metadata 200 / whitelist 200 / billing 200 / 生产页面 200
- [ ] 根域 `cinachain.com` 门户/重定向（可选 Phase 3）
- [ ] docs.cinachain.com 文档站（可选 Phase 3）
- [ ] ⚠️ 本次使用的 `cfut_m9mT...` token 用完建议轮换（曾出现在对话）
- [ ] 已知边缘：Pages 部署瞬间新 chunk 若被请求并缓存 404（immutable 头）→ 低频；预防 = 部署后 purge（需更高权限 token），暂不实施
