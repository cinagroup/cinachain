# CinaChain Base Sepolia Beta 发布指南

本文档描述仓库当前的发布边界：**Base Sepolia Testnet / Beta**。测试网资产没有真实价值；代码或配置中出现域名、项目名和合约地址，不等于对应远端版本已成功发布。

## 1. 发布拓扑

| 产品面   | 目标域名                                         | Cloudflare 发布单元           | 仓库路径                 |
| -------- | ------------------------------------------------ | ----------------------------- | ------------------------ |
| 品牌门户 | [cinachain.com](https://cinachain.com)           | Pages `cinachain-portal`      | `portal/`                |
| NFT DApp | [nft.cinachain.com](https://nft.cinachain.com)   | Pages `cinachain-dapp-v2`     | 根目录静态导出 `out/`    |
| 文档     | [docs.cinachain.com](https://docs.cinachain.com) | Pages `cinachain-docs`        | `docs-site/build/`       |
| 计费 API | Cloudflare Worker 路由                           | Worker `cinachain-billing`    | `workers/billing/`       |
| 媒体网关 | Cloudflare Worker 路由                           | Worker `cinachain-mega-media` | `workers/media-gateway/` |

根工作流会发布上表的三个 Pages 项目以及计费、媒体两个 Worker。`workers/whitelist/`、`workers/paymaster/` 和 `workers/rpc-proxy/` 是独立发布单元，目前不在根工作流的自动发布步骤中。自定义域名、路由和实际版本必须在 Cloudflare Dashboard 中复核。

## 2. 本地开发与配置

### 安装和启动

```powershell
npm ci --legacy-peer-deps
Copy-Item .env.example .env.local
npm run dev
```

浏览器访问 `http://localhost:3000`。`.env.example` 只提供本地占位结构；测试合约流程前，必须将占位地址和公共客户端标识替换为 Base Sepolia 对应值。

### 配置边界

- `NEXT_PUBLIC_*` 会进入浏览器产物，只能包含公开信息，例如 Base Sepolia 合约地址、公共网关 URL 和 Reown 项目标识。
- Cloudflare 账户凭据、RPC 服务凭据、管理员密钥、加密密钥和部署私钥都属于服务端机密，不得使用 `NEXT_PUBLIC_*`，不得提交到 Git，也不得写入命令行参数。
- 根目录 `.env.production` 只允许保存公开构建配置。Worker 机密必须使用 Cloudflare encrypted secrets。
- `.dev.vars` / `.env.local` 仅用于本机，保持未跟踪状态。

## 3. 发布前质量门禁

从仓库根目录运行：

```powershell
npm run design:tokens:check
npm run security:config
npm run typecheck
npx tsc -p workers/rpc-proxy/tsconfig.json --pretty false
npm run lint
npm test
npm run build
```

文档站单独验证：

```powershell
Set-Location docs-site
npm ci --legacy-peer-deps
npm run build
Set-Location ..
```

任一步失败都应停止发布。不要通过跳过检查、忽略类型错误或删除锁文件来制造“成功”结果。

## 4. Cloudflare 凭据与 Worker 机密

GitHub Actions 需要以下仓库 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

计费 Worker 还要求 Cloudflare 中存在以下 encrypted secret bindings：

- `ADMIN_KEY`
- `INGRESS_ENC_KEY`

先在安全的本地进程环境中提供新值，再从仓库根目录执行：

```powershell
npm --prefix workers/billing ci --ignore-scripts
npm run secrets:billing
npm run secrets:billing:check
```

`secrets:billing` 通过标准输入交给 Wrangler，不会把值放进命令参数；`secrets:billing:check` 只检查绑定名称。若检查失败，禁止发布计费 Worker。轮换后还要撤销旧凭据并验证管理接口仍拒绝无效认证。

## 5. 自动发布行为

`.github/workflows/deploy.yml` 的当前行为是：

1. Pull request 运行根质量门禁和文档构建，不执行发布。
2. 推送到 `main` 后，所有发布 job 仍需先通过质量门禁。
3. DApp、门户和文档分别发布到自己的 Cloudflare Pages 项目。
4. Worker job 先验证 Cloudflare 凭据和计费 secret bindings，再发布计费与媒体 Worker。
5. 工作流使用固定的 Wrangler 4 版本，避免发布时隐式漂移。

推送到 `main` 只是触发器，不应当作发布成功证据。以 GitHub Actions job 结果、Cloudflare deployment revision 和线上验收结果为准。

## 6. 手动发布

仅在质量门禁通过、Cloudflare 身份已配置，并确认不会覆盖错误项目后执行。

复用前面通过 lockfile 安装的部署 CLI，并保存其绝对路径：

```powershell
$Wrangler = (Resolve-Path ".\workers\billing\node_modules\.bin\wrangler.cmd").Path
$Commit = (git rev-parse HEAD).Trim()
```

### NFT DApp

```powershell
npm run build
& $Wrangler pages deploy out --project-name=cinachain-dapp-v2 --branch=main --commit-hash=$Commit
```

### 品牌门户

```powershell
& $Wrangler pages deploy portal --project-name=cinachain-portal --branch=main --commit-hash=$Commit
```

### 文档站

```powershell
Set-Location docs-site
npm ci --legacy-peer-deps
npm run build
& $Wrangler pages deploy build --project-name=cinachain-docs --branch=main --commit-hash=$Commit
Set-Location ..
```

### 自动发布范围内的 Workers

```powershell
npm run secrets:billing:check

Set-Location workers/billing
& $Wrangler deploy
Set-Location ../media-gateway
& $Wrangler deploy
Set-Location ../..
```

媒体 Worker 依赖 R2 bucket 和自身配置；计费 Worker 依赖 KV、定时触发器和 required secrets。执行前应分别检查对应 `wrangler.toml` 与目标 Cloudflare 账户。其他 Worker 必须作为独立变更单元审核、配置和验证，不要假设根工作流已发布它们。

## 7. 合约发布原则

- 当前 DApp 网络是 Base Sepolia（chain ID `84532`）。
- 部署前运行 Foundry 编译和测试，并确认脚本的 RPC、chain ID 与合约构造参数均指向 Base Sepolia。
- 私钥和区块浏览器 API 凭据只放在安全的本地环境或 CI secret 中。
- 部署后在 Base Sepolia BaseScan 验证合约，再更新公开的 `NEXT_PUBLIC_*_CONTRACT` 配置并重新构建 DApp。
- 不要在同一提交中悄然切换网络、RPC 与合约地址；迁移到其他网络应单独设计、审核和验收。

## 8. 发布后验收

### Pages 与品牌

- [ ] `cinachain.com` 展示品牌门户，Logo、favicon 和社交卡片正确
- [ ] `nft.cinachain.com` 展示 DApp，而不是门户或文档站
- [ ] `docs.cinachain.com` 展示当前文档站，导航链接回正确产品面
- [ ] 三个域名的 TLS、重定向、缓存头和 Cloudflare deployment revision 已核对

### DApp 与链上读取

- [ ] UI 明确显示 `Base Sepolia Testnet` 与 `Beta`
- [ ] 钱包连接后网络为 chain ID `84532`
- [ ] `/explore`、`/mint`、`/dashboard`、`/dashboard/nfts` 和 `/admin` 的加载、空数据、错误与成功状态可辨识
- [ ] 交易和合约链接指向 Base Sepolia BaseScan
- [ ] IPFS / R2 媒体回退可用，RPC 请求未暴露服务端凭据

### Workers

- [ ] Worker 路由指向本次 deployment revision
- [ ] 健康检查与预期 API 路由返回正确状态码
- [ ] 计费管理接口拒绝缺失或错误的认证信息
- [ ] 日志不包含密钥、令牌、私钥或完整敏感请求体
- [ ] KV、R2 和定时触发器绑定到目标账户中的正确资源

## 9. 常见问题

**依赖安装失败**

确认 Node.js 22 与 npm 可用，然后重试 `npm ci --legacy-peer-deps`。不要删除 `package-lock.json`；锁文件是可复现构建的一部分。

**TypeScript 或构建失败**

先分别运行 `npm run typecheck`、`npm run lint` 和 `npm test` 获取最小失败范围，再运行 `npm run build`。RPC proxy 使用自己的 TypeScript 配置，需要单独检查。

**计费 Worker 被发布门禁阻止**

运行 `npm run secrets:billing:check` 查看缺失的绑定名称。通过安全渠道配置并轮换 secret 后再发布，不要把值补回 `wrangler.toml`。

**页面可以打开但内容异常**

确认 Cloudflare 自定义域名映射到了正确 Pages 项目，并对照 deployment revision；随后检查 Base Sepolia 公共配置、浏览器 Network 面板和 Worker 日志。

## 10. 监控与维护

- 持续观察 Pages 与 Workers 的错误率、延迟、请求量和用量告警。
- 定期核对 KV、R2、cron 和自定义域名绑定，避免环境漂移。
- 轮换部署凭据和 Worker secrets；发生泄露时先撤销旧值，再验证新值生效。
- 每次发布保存 Git commit、Cloudflare revision、验收时间和已知限制，便于回滚与审计。

---

**文档版本**: v2.0

**更新日期**: 2026-08-11

**维护者**: cinagroup
