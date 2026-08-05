# CinaMega：ucina/mcina/cina 亿级副本合集 + 双向兑换（Base Sepolia，方案 B 存储）

## 产品语义（已确认）
- 单 ERC-1155 合约 `CinaMega.sol`，三个 tokenType：`UCINA=1, MCINA=2, CINA=3`
- 固定汇率：**1 cina = 1000 mcina = 1,000,000 ucina**，双向兑换（burn→mint 原子完成，floor 取整，dust 在源侧销毁）
- 铸造：**ucina 公开免费 mint（per-address cap 防女巫，默认 1000/地址，owner 可调）；mcina/cina 仅通过兑换获得**（经济闭环：铸最小单位→向上兑换）——如你希望三档都可直接 mint，批准时说明即可
- 部署：Base Sepolia（owner/admin 沿用 `0x9D81DeFB...`）

## T1 合约层（CinaMega.sol，参照 CinaBadge/CinaCredit 惯例：OZ v5 + Ownable + Pausable + ReentrancyGuard + 命名 error + 禁止 renounce）

```
uint256 public constant UCINA=1, MCINA=2, CINA=3
mapping(uint256 => bytes)  public typeRawSvg   // tokenType => 原始 SVG bytes（链上兜底）
mapping(uint256 => string) public typeCid      // tokenType => immutable IPFS CID
uint256 public mintCapPerAddress              // ucina 公开 mint 上限（默认 1000）
bool    public svgLocked                       // 素材写入后锁死，不可改（附件2硬性要求）
```
- `uri(uint256)` → `"ipfs://<typeCid[type]>/metadata.json"`（轻量，市场兼容）
- `getBackupSvgRaw(uint256)` view（仅 Worker 灾难兜底调用）
- `initTemplate(type, rawSvg, cid)` onlyOwner，分批写入后 `lockTemplates()` 彻底锁死
- `mintUcina(uint256 amount)` 公开、free、per-address cap（`MintCapExceeded`）
- `exchange(fromType, toType, amount)` nonReentrant：校验类型 ∈ {1,2,3}、from≠to；`toAmount = amount * RATE[from] / RATE[to]`（floor）；RATE={1,1000,1000000}；`_burn(from)` + `_mint(to)`；dust 自动销毁
- 事件：`Exchanged(from,to,amount,toAmount)`、`TemplatesLocked`
- **编译**：`scripts/compile-and-deploy.mjs` outputSelection 增加 CinaMega；**部署**：新 `scripts/deploy-mega.mjs`（viem，deploy → initTemplate×3 → lockTemplates，需 `scripts/generate-mega-assets.mjs` 输出的 SVG/CID）；**验证**：新 `scripts/test-mega.mjs`（铸造/兑换/汇率/dust/锁死 revert 断言，模仿 test-credit.mjs 模式）；`contracts/test/CinaMega.t.sol` 一并编写（forge 可用时跑）
- 地址记录：`lib/contracts/addresses.ts` 加 `CINA_MEGA_CONTRACT` + `hasMegaContract`；`env.mjs`（client + runtimeEnv）、`.env.local`、`.env.production` 加 `NEXT_PUBLIC_CINA_MEGA_CONTRACT`

## T2 素材管线 + 4EVERLAND
- 新 `scripts/generate-mega-assets.mjs`：程序化生成 3 个模板 SVG（1024×1024 纯矢量：ucina=青、mcina=绿、cina=金，含名称 + 汇率表 `1 CINA = 1000 MCINA = 1,000,000 UCINA`）+ 3 个 `metadata.json`（name/description/image/attributes），写入 `mega-assets/`；本地离线备份保留
- 新 `scripts/upload-mega-assets.mjs`：4EVERLAND 上传 + pin（**需你提供 4EVERLAND API token**，见下方外部依赖），输出 3 个 CID 供 T1 部署与 T3 网关配置
- 无 4EVERLAND token 时 T2 阻塞，T1/T3/T4 可并行推进

## T3 媒体网关 Worker（方案 B 四层降级）
- 新 `workers/media-gateway/`（仿 rpc-proxy 的 fallback 模式 + billing 的 CORS/health 惯例）：
  - 路由：`GET /<cid>/metadata.json`、`GET /<cid>/<svg>.svg`（R2 key 直接用 CID 或 CID+文件名）
  - 降级链：**R2 命中 → 4EVERLAND 自定义网关回源（成功写回 R2）→ 链上 `getBackupSvgRaw`（5 QPS 限流，成功写回 R2，每模板仅一次链上调用）→ 503**
  - 缓存头：镜像 `public,max-age=2592000`；JSON `public,max-age=600`（对齐现有 `_headers` 契约）
  - 绑定：`r2_buckets` `CINA_MEGA_MEDIA`；`wrangler.toml`（name `cinachain-mega-media`，默认域 `cinachain-mega-media.cinagroup.workers.dev`，**零 DNS 阻塞**；`mega.cinachain.com` 自定义域名列为可选增强）
  - 测试：`workers/media-gateway/src/index.test.js`（纯函数化降级链决策 + R2 回写 + 限流）
- CI：`deploy.yml` 增加 media-gateway 部署步骤（模仿 billing worker 步骤）

## T4 前端
- `lib/contracts/cina-mega.ts`：ABI（parseAbiItem 风格，uri/balanceOf/balanceOfBatch/typeCid/getBackupSvgRaw/mintUcina/exchange/…）
- `lib/exchange.ts` 纯函数：`RATES = {1:1n, 2:1000n, 3:1000000n}`、`convertAmount(from,to,amount)`（floor + dust）、方向与校验；`lib/__tests__/exchange.test.ts`（覆盖双向、dust、非法类型）
- `lib/hooks/use-cina-mega.ts`：multicall（三档 balanceOfBatch + typeCid + mintCap + svgLocked），`COLLECTION_INFO` 映射（仿 BADGE_INFO）
- `lib/mega-media.ts`：`ipfs://<cid>/metadata.json` → `https://cinachain-mega-media.cinagroup.workers.dev/<cid>/metadata.json`（多网关回退：worker → cloudflare-ipfs → ipfs.io）
- 页面（均 `app/(general)/` 路由组，零 layout 改动）：
  - `collections/page.tsx`：三合集展示（模板图预览、汇率卡、你的余额、总 supply、mint ucina 按钮【含 ⚡Gasless 复用 `usePaymasterCapabilities`】+ **SA 用户禁止向 counterfactual 地址转资产的提示**（附件 1 采纳点））
  - `exchange/page.tsx`：双向兑换（仿 credits 页"你给/你收"双卡 + 实时数学 + `useWriteContract`/gasless 分支 + explorer 链接 + `invalidateQueries(["readContract"],["readContracts"],["balance"])`）
- 导航：`main-nav.tsx` + `mobile-nav.tsx` + `footer.tsx` 加 Collections/Exchange 链接；首页产品矩阵更新

## T5 验证 + 文档
- 全量：`npx vitest run` + `npm run build` + 浏览器 E2E（collections/exchange 页 + 连接 + 兑换 UI 数学）
- 生产验证：部署后 worker `/health` + 媒体 URL 全链路（R2→回源→链上兜底逐级验证）
- 文档：`docs/` 更新 spec（CinaMega 设计 + 方案 B 落地记录 + 运维巡检说明）

## 外部依赖（需你操作，阻塞对应任务）
1. **4EVERLAND API token**（注册 4everland.org → 控制台 → API Key）→ 阻塞 T2 上传；无 token 时 T1 可用占位 CID 继续（后续补传 + 合约 initTemplate）
2. **部署私钥**（现有 `DEPLOY_PRIVATE_KEY` 环境变量，沿用 deploy.mjs 惯例）
3. Base Sepolia 测试 ETH（水龙头，owner 地址已有？沿用现有脚本即可）

## 实施顺序
T1 合约（可脱离 4EVERLAND 先做）→ T4 前端（依赖 T1 地址）→ T3 网关（独立）→ T2 素材（等 token）→ T5 验证。每任务 subagent 驱动 + review。