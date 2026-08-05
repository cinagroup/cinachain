# CinaMega — 亿级副本合集 + 固定汇率兑换（设计文档）

## 1. 定位

三个模板化 ERC-1155 亿级副本合集（ucina/mcina/cina）+ 固定汇率双向兑换。
素材采用"链上 SVG 兜底 + immutable IPFS CID + Cloudflare R2 缓存 + 4EVERLAND Pin"
四层架构（附件 2 方案 B 落地）。

## 2. 合约（contracts/src/CinaMega.sol，Base Sepolia）

| TokenType | 单位值 | 获取方式 |
|---|---|---|
| 1 = UCINA | 1 unit | 公开免费 mint（per-address cap，默认 1,000,000） |
| 2 = MCINA | 1,000 units | 仅兑换 |
| 3 = CINA | 1,000,000 units | 仅兑换 |

- 固定汇率：**1 CINA = 1,000 MCINA = 1,000,000 UCINA**
- `exchange(fromType, toType, amount)`：原子 burn→mint；`toAmount = amount * units[from] / units[to]`（floor）；dust 在源侧销毁；`toAmount == 0` → `ExchangeTooSmall` revert
- `initTemplate(type, rawSvg, cid)`：写链上 SVG 兜底 + immutable CID；`lockTemplates()` 后永久锁死（附件 2 硬性要求：全部 tokenType 必须写入后才可锁）
- `uri(type)` → `ipfs://<cid>/metadata.json`（轻量，市场兼容）；`getBackupSvgRaw(type)` 仅 Worker 灾难兜底调用
- 惯例：OZ v5 + Ownable + Pausable + ReentrancyGuard + 命名 error + renounce 禁止

## 3. 素材管线（scripts/）

1. `generate-mega-assets.mjs` — 生成 3 个矢量 SVG 模板 + metadata.json（`mega-assets/`，本地离线备份）
2. `upload-mega-assets.mjs` — 本地确定性 CID 计算（ipfs-unixfs-importer，metadata.image 引用 SVG **文件** CID 避免循环引用）→ 4EVERLAND S3 上传 + Pinning API pin 目录 CID → `cids.json`。`LOCAL_ONLY=1` 可离线预计算
3. `init-mega-templates.mjs` — 网关预检（每个 CID 可访问）→ `initTemplate`×3 → `lockTemplates`（不可逆）
4. `test-mega.mjs` — 链上断言：单位换算、mint cap、双向兑换、dust、revert 守卫

## 4. 媒体网关（workers/media-gateway，cinachain-mega-media）

四层降级（`/<cid>/metadata.json`、`/<cid>/<name>.svg`）：

```
R2 命中（常态） → 4EVERLAND 自定义网关回源（写回 R2）
  → 链上 getBackupSvgRaw（5 QPS 限流，组装 metadata 或直出 SVG，写回 R2）
  → 503
```

- 缓存头对齐 `_headers` 契约：SVG `max-age=2592000, immutable`；JSON `max-age=600`
- CORS 仅放行自有域名（媒体公开内容如需第三方市场访问，改 `*`）
- wrangler 变量：`FOUR_EVERLAND_GATEWAY`（自定义域名网关，禁用公共网关）、`CINA_MEGA_ADDRESS`、`MEGA_TYPE_CIDS`（cid:type 映射）、`BASE_SEPOLIA_RPC`
- CI 自动部署（幂等创建 R2 bucket）

## 5. 前端

- `app/(general)/collections/page.tsx`：三合集展示（网关图片 + 公共网关回退）、免费 mint UCINA（gasless 三路径）、**counterfactual SA 资产警告**（附件 1 采纳）
- `app/(general)/exchange/page.tsx`：双向兑换（实时换算、dust 提示、最小量提示、gasless）
- `lib/exchange.ts` 纯函数（11 单测）+ `lib/hooks/use-cina-mega.ts`（multicall）+ `use-mint-ucina` / `use-exchange`（EIP-5792 callsId 解析）
- env：`NEXT_PUBLIC_CINA_MEGA_CONTRACT`、`NEXT_PUBLIC_MEGA_MEDIA_URL`

## 6. 部署流程（顺序不可颠倒）

```
1. DEPLOY_PRIVATE_KEY=... node scripts/deploy-mega.mjs        # 部署合约（不写模板）
2. FOUR_EVERLAND_TOKEN=... node scripts/upload-mega-assets.mjs # 上传素材 → cids.json
3. wrangler r2 bucket create cinachain-mega-media             # R2（CI 幂等）
4. 配置 media-gateway vars（FOUR_EVERLAND_GATEWAY / CINA_MEGA_ADDRESS / MEGA_TYPE_CIDS）
5. CINA_MEGA_CONTRACT=<addr> node scripts/init-mega-templates.mjs  # 写模板 + 锁死（不可逆！）
6. 前端 env 填地址 → 部署 Pages
7. CINA_MEGA_CONTRACT=<addr> node scripts/test-mega.mjs       # 链上验证
```

⚠️ 锁死前必须确认：三 CID 均已在网关可访问；任何素材修改都必须在第 5 步之前完成。

## 7. 运维

- 巡检：定期探测 3 个 CID 经网关的可访问性（R2 命中率、4EVERLAND 回源率、链上兜底触发次数）
- 故障：4EVERLAND 单点故障 → 自动走链上兜底（5 QPS 限流保护 RPC）；人工恢复 = 重新上传/pin + R2 预热
- 已知边界：第三方市场直接读 IPFS，不走 Worker——4EVERLAND 故障时第三方市场裂图不可自动修复（附件 2 明确）
- 安全：mint cap 防女巫；兑换无套利面（固定汇率、floor、dust 销毁）；链上兜底限流防 RPC 打爆

## 8. 状态

| 项 | 状态 |
|---|---|
| 合约 + 编译 + t.sol（forge 待装）+ 脚本 | ✅ 已提交（3ac048a） |
| 素材生成 + 本地 CID 管线 | ✅ 已提交 |
| media-gateway worker（13 单测）+ CI | ✅ 已提交 |
| 前端（149 单测 + build + 浏览器 0 errors） | ✅ 已提交（02f6094） |
| 链上部署 + 模板锁死 | ⏳ 阻塞：需 DEPLOY_PRIVATE_KEY + 4EVERLAND token |
| 生产验证 | ⏳ 待部署后 |
