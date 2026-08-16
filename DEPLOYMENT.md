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
- 根目录 `.env.production` 只允许保存公开构建配置。生产和本地 Worker 机密都使用 Cloudflare Secrets Store binding；普通字符串变量不能替代运行时所需的异步 `get()` binding。
- `.env.local` 仅用于本机公开客户端配置并保持未跟踪状态；不要在 `.dev.vars` 中为 `ADMIN_KEY` / `INGRESS_ENC_KEY` 定义字符串。

### CinaAuth 登录（OIDC 机密客户端 + 同源代理）

DApp 的登录使用 CinaAuth 统一认证（`https://auth.cinaseek.ai`，登录界面为 `accounts.cinaseek.ai`），走 OpenID Connect Authorization Code + PKCE 流程；静态导出没有服务端运行时，授权码在 `/auth/callback` 页面客户端兑换。

两层结构：

- **CORS 层**：CinaAuth worker 的 CORS 只对第一方来源放行，因此浏览器侧 OIDC 请求（discovery、token、userinfo、JWKS）由 `workers/auth-proxy`（`cinachain-auth-proxy`）做同源转发。路由 `nft.cinachain.com/api/auth/*` 比 Pages 自定义域路由更具体，命中该 worker，其余路径仍由静态导出服务。`authorize` 与 `end-session` 是整页跳转，直连 issuer，不经代理。
- **机密层**：开发者控制台只有 Web（机密，`client_secret_basic`）和 Native 两种类型，没有 SPA 选项。注册 **Web server application** 后，token 请求的 Basic 认证由 auth-proxy 在服务端注入（凭据存为 Worker secret），浏览器侧保持公共客户端形态，**client secret 永不进入浏览器构建**；PKCE（S256）始终强制发送。

一次性接入配置：

1. 登录 `https://accounts.cinaseek.ai/dashboard/developer` 创建 OAuth 客户端（**Web server application** 类型），并在 Allowed scopes 中**勾选 offline_access**（默认不勾选；不勾选时登录会自动降级为无刷新令牌的约 1 小时会话，控制台补勾后下次登录自动恢复 30 天续期）。回调地址登记精确匹配值：生产 `https://nft.cinachain.com/auth/callback`；本地调试可另加 `http://localhost:3000/auth/callback`（回环地址允许 HTTP）。登出回调登记 `https://nft.cinachain.com`。
2. 在 GitHub 仓库 Secrets 中配置 `NEXT_PUBLIC_CINAAUTH_CLIENT_ID`（client id，公开值）与 client secret（名字为 `CINAAUTH_CLIENT_SECRET` 或 `NEXT_PUBLIC_CINAAUTH_CLIENT_SECRET` 均可，工作流两者兼容；secret 只下发到 auth-proxy Worker）。CI 构建 DApp 时注入 client id，推送 main 时把两者写入 Worker secret；client secret 缺失时 CI 会告警并按公共客户端直通模式运行，client id 缺失时 CI 直接失败（登录按钮会整体禁用）。
3. 确保 `workers/auth-proxy` 已部署且路由生效（根工作流随 billing/media-gateway 一起发布；部署令牌需含 cinachain.com zone 的 Workers 路由权限）。

`.env.production` 里的 `NEXT_PUBLIC_CINAAUTH_CLIENT_ID` 留空即可（CI 用 GitHub secret 注入；本地想跑生产构建可在未跟踪的 `.env.local` 里填）。

本地开发（可选，仅调试登录时需要）：

```powershell
Set-Content workers\auth-proxy\.dev.vars "CINAAUTH_CLIENT_ID=<client id>`nCINAAUTH_CLIENT_SECRET=<client secret>"
Set-Location workers/auth-proxy
& (Resolve-Path "..\billing\node_modules\.bin\wrangler.cmd").Path dev --port 8787
Set-Location ..\..
```

并在 `.env.local` 中设置 `NEXT_PUBLIC_CINAAUTH_CLIENT_ID=<client id>` 与 `NEXT_PUBLIC_CINAAUTH_API_BASE_URL=http://localhost:8787/api/auth`（`.dev.vars` 已被 gitignore 覆盖，不会提交）。

会话保存在浏览器 `localStorage`（key `cinachain-auth-session`），access token 过期时用 refresh token 自动续期，续期失败则要求重新登录。管理员入口（`/admin`）仍基于连接钱包地址与 `NEXT_PUBLIC_APP_ADMINS` 白名单，与 CinaAuth 登录无关。

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

由于计费 Worker 会部署 Secrets Store bindings，CI API token 除现有 Worker/Pages 发布权限外，还必须拥有账户级 **Secrets Store Edit** 权限；只有 Secrets Store Read 权限可以列出元数据，但无法在部署时绑定机密。机密自身还必须包含 `workers` scope。

> Cloudflare Secrets Store 当前为 open beta。Wrangler 的生产命令必须显式使用 `--remote`；beta 命令或权限检查失败时应停止发布，不得跳过门禁。

计费 Worker 使用账户 Store `346e2b4b86334bc29083c064116e91cf` 中的以下不可变、版本化条目：

| Worker binding    | Secrets Store secret                   | 要求                       |
| ----------------- | -------------------------------------- | -------------------------- |
| `ADMIN_KEY`       | `CINACHAIN_BILLING_ADMIN_KEY_V1`       | `active` + `workers` scope |
| `INGRESS_ENC_KEY` | `CINACHAIN_BILLING_INGRESS_ENC_KEY_V1` | `active` + `workers` scope |

先在安全的本地进程环境中提供新值，再从仓库根目录执行：

```powershell
npm --prefix workers/billing ci --ignore-scripts
npm run secrets:billing
npm run secrets:billing:check
```

`secrets:billing` 使用锁定的 Wrangler 4.101，只创建缺失的 V1 条目：每个值单独通过标准输入传递，两个值都从子进程环境移除，并且永远不会使用 `--value`、命令参数或日志承载值。已存在且为 `active` + `workers` 的 V1 会幂等跳过；已存在但状态或 scope 错误时脚本会失败，不会原地覆盖。

Secrets Store 保存后不再允许读取明文。创建前必须将新的 `ADMIN_KEY` 保存在团队批准的密码管理器中；它至少 32 个字符且不得包含空白。轮换必须新增 V2（或更高版本）secret name、更新 Worker binding、验证并发布，再停用旧版本；不要用同名覆盖来假装完成轮换。`INGRESS_ENC_KEY` 必须是 32 个随机字节的 64 位十六进制表示，轮换前还要设计旧 KV 密文的重加密或失效方案。

`secrets:billing:check` 远端核对名称、`active` 状态和 `workers` scope。任一项不满足时禁止发布计费 Worker；发布后还要验证旧管理员凭据被拒绝、新凭据成功，且日志没有泄露值。

本地 `wrangler dev` 也必须创建同一 store ID 和 secret name 的本地 Secrets Store 条目。以下命令**不要**添加 `--remote` 或 `--value`；让 Wrangler 交互式读取值，并把本地状态保存在已忽略的 `workers/billing/.wrangler/`：

```powershell
Set-Location workers/billing
$Wrangler = (Resolve-Path ".\node_modules\.bin\wrangler.cmd").Path
& $Wrangler secrets-store secret create 346e2b4b86334bc29083c064116e91cf --name CINACHAIN_BILLING_ADMIN_KEY_V1 --scopes workers
& $Wrangler secrets-store secret create 346e2b4b86334bc29083c064116e91cf --name CINACHAIN_BILLING_INGRESS_ENC_KEY_V1 --scopes workers
& $Wrangler dev
Set-Location ../..
```

生产 Secrets Store 的值不会自动进入本地环境；本地条目也不会修改远端账户。

## 5. 自动发布行为

`.github/workflows/deploy.yml` 的当前行为是：

1. Pull request 运行根质量门禁和文档构建，不执行发布。
2. 推送到 `main` 后，所有发布 job 仍需先通过质量门禁。
3. DApp、门户和文档分别发布到自己的 Cloudflare Pages 项目。
4. Worker job 先验证 Cloudflare 凭据和计费 Secrets Store 元数据，再发布计费、媒体与认证代理 Worker。
5. 工作流使用固定的 Wrangler 4 版本，避免发布时隐式漂移。

推送到 `main` 只是触发器，不应当作发布成功证据。以 GitHub Actions job 结果、Cloudflare deployment revision 和线上验收结果为准。

## 6. 手动发布

仅在质量门禁通过、Cloudflare 身份已配置，并确认不会覆盖错误项目后执行。

复用前面通过 lockfile 安装的部署 CLI，并保存其绝对路径：

```powershell
$Wrangler = (Resolve-Path ".\workers\billing\node_modules\.bin\wrangler.cmd").Path
$null = git fetch origin main
$Branch = (git branch --show-current).Trim()
$Commit = (git rev-parse HEAD).Trim()
$OriginMain = (git rev-parse origin/main).Trim()

if ($Branch -ne "main") { throw "Production deploy requires the main branch." }
if ($Commit -ne $OriginMain) { throw "Local main must exactly match origin/main." }
if ((git status --porcelain).Count -ne 0) { throw "Production deploy requires a clean worktree." }
```

### NFT DApp

```powershell
npm run build
& $Wrangler pages deploy out --project-name=cinachain-dapp-v2 --branch=main --commit-hash=$Commit
```

### 品牌门户

品牌门户是独立的 Vite + React 应用（`portal/`），需先构建再发布：

```powershell
Set-Location portal
npm ci
npm run build
& $Wrangler pages deploy dist --project-name=cinachain-portal --branch=main --commit-hash=$Commit
Set-Location ..
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
Set-Location ../auth-proxy
& $Wrangler deploy
Set-Location ../..
```

媒体 Worker 依赖 R2 bucket 和自身配置；计费 Worker 依赖 KV、定时触发器及上述账户级 Secrets Store bindings；认证代理 Worker（CinaAuth 登录的同源 `/api/auth/*` 转发）依赖 cinachain.com zone 上的 Workers 路由 `nft.cinachain.com/api/auth/*`，机密客户端还依赖两个 Worker secret：

```powershell
Set-Location workers/auth-proxy
& $Wrangler secret put CINAAUTH_CLIENT_ID
& $Wrangler secret put CINAAUTH_CLIENT_SECRET
Set-Location ../..
```

执行前应分别检查对应 `wrangler.toml` 与目标 Cloudflare 账户。其他 Worker 必须作为独立变更单元审核、配置和验证，不要假设根工作流已发布它们。

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

### CinaAuth 登录

- [ ] 已在开发者控制台登记回调 `https://nft.cinachain.com/auth/callback`（Web server application 类型）
- [ ] GitHub Secret `NEXT_PUBLIC_CINAAUTH_CLIENT_ID` 已配置（client secret 同理），CI 无相关告警
- [ ] auth-proxy Worker 的 `CINAAUTH_CLIENT_ID` / `CINAAUTH_CLIENT_SECRET` 两个 secret 已存在（`wrangler secret list`）
- [ ] `nft.cinachain.com/api/auth/.well-known/openid-configuration` 经 auth-proxy worker 返回 discovery 文档（响应含 `issuer: https://auth.cinaseek.ai`）
- [ ] 顶栏 Sign In 能跳转 accounts.cinaseek.ai，登录后回到发起页面并显示已登录账户（token 交换经代理注入 Basic 认证成功）
- [ ] 登出会经过 end-session 端点并回到站点首页
- [ ] 钱包断开不影响登录态；登录态不影响钱包连接入口

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

运行 `npm run secrets:billing:check` 查看具体问题：条目可能缺失、仍为 `pending`，或缺少 `workers` scope。确认 CI token 拥有账户级 Secrets Store Edit 权限，通过安全渠道配置后再发布；不要把值补回 `wrangler.toml`，也不要跳过元数据门禁。

**页面可以打开但内容异常**

确认 Cloudflare 自定义域名映射到了正确 Pages 项目，并对照 deployment revision；随后检查 Base Sepolia 公共配置、浏览器 Network 面板和 Worker 日志。

## 10. 监控与维护

- 持续观察 Pages 与 Workers 的错误率、延迟、请求量和用量告警。
- 定期核对 KV、R2、cron 和自定义域名绑定，避免环境漂移。
- 通过新版本名称轮换部署凭据和 Secrets Store entries；发生泄露时先绑定并验证新版本，再撤销旧版本和旧凭据。
- 每次发布保存 Git commit、Cloudflare revision、验收时间和已知限制，便于回滚与审计。

---

**文档版本**: v2.1

**更新日期**: 2026-08-16

**维护者**: cinagroup
