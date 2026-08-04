# CinaChain API 计费与会员系统 — 设计方案

- **日期**: 2026-08-04
- **状态**: 已批准（用户确认"继续"）
- **范围**: 将现有 CinaChain NFT 体系（CinaNFT ERC-721 + CinaBadge ERC-1155）扩展为面向"API token 服务网站"的计费与会员系统
- **目标网络**: 先 Base Sepolia（测试网验证），后 Base 主网（同构迁移）

---

## 1. 需求与已确认决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 计费模式 | **预充值 + 按量扣费**（类 OpenAI：用户充余额，API 调用按 token 扣费） |
| 2 | NFT 角色 | **余额载体（链上计量）**——链上资产即额度 |
| 3 | 扣费执行 | **链上额度 + 服务端计量**——每请求 0 gas，余额用尽即停（429） |
| 4 | 余额形态 | **ERC-20 信用 token（CinaCredit）**——可拆分、可转让、可部分扣减 |
| 5 | 支付通道 | **纯链上**（ETH/USDC → 合约按汇率铸造 Credit） |
| 6 | 会员模型 | **消费驱动等级**（累计消耗达标升级，映射徽章体系） |
| 7 | 接入方式 | **双轨：托管 + 自托管**（无钱包用户走平台托管，钱包用户自持） |
| 8 | 目标网络 | 先测试网，后主网 |
| 9 | 新增铸造通道 | **Key 入金（延迟确认制）**——用户提供 API key + 申报额度，key 被调用确认后平台铸造 Credit |
| 10 | Key 估值 | **用户申报兑换额度，key 被调用并确认后完成铸造**（平台零坏账） |

**核心公式**（贯穿全系统）：
```
可用额度 = 链上余额快照 − 服务端已承诺消耗
```

---

## 2. 系统架构（六层）

```
┌───────────────────────── 用户侧 ─────────────────────────┐
│  [充值页]  钱包 ── ETH/USDC ──▶ ①CinaCredit 合约 ──▶ 余额  │
│  [Key入金]  提交 key ──▶ 验证/池化 ──▶ 调用确认 ──▶ 铸造    │
│  [API 调用] ── API Key(绑定地址/SIWE) ──▶ ②计量网关        │
└──────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
  ③ 事件索引器          ④ 服务端账本(KV/D1)     ⑤ 会员引擎
  CinaCredit             usable = 链上余额         累计消耗 → 等级
  Transfer 事件          − 已承诺消耗              折扣/限速 → 徽章
  → 更新余额快照          (0 gas/请求)              发放(平台触发)
```

| # | 层 | 职责 | 技术 |
|---|---|---|---|
| ① | CinaCredit 合约 | 充值铸造 / 转账 / 兑出（唯一链上资产层） | 新 ERC-20（Solidity + viem 部署） |
| ② | 计量网关 | 每次 API 调用扣 token、429 限停 | Cloudflare Worker 中间件 |
| ③ | 事件索引器 | 监听 Transfer 事件同步"链上余额快照" | Worker 定时轮询 + 对账 |
| ④ | 服务端账本 | 累计消耗、可用额度、充值记录、Key 池 | Worker KV / D1 |
| ⑤ | 会员引擎 | 等级判定、折扣应用、徽章授予 | 服务端 + CinaBadge |
| ⑥ | 前端/管理 | 充值页、余额/等级页、API Key 管理、后台配置 | 现有 Next.js DApp |

设计原则：每层单一职责、通过明确定义的接口通信；链上资产层与计量层解耦（链上只记录充值/转账，不记录消耗）。

---

## 3. 智能合约层

### 3.1 CinaCredit（新 ERC-20，核心资产）

```solidity
contract CinaCredit is ERC20, Ownable, Pausable, ReentrancyGuard {
    uint256 public ethToCreditRate;     // 1 ETH = N Credit（owner 可调）
    address public treasury;            // 收入金库
    uint256 public platformFeeBps;      // 平台费（如 200 = 2%，可 0）

    // 通道 1：ETH 充值（用户自助，即时）
    function mintWithEth() external payable nonReentrant whenNotPaused;

    // 通道 2/3：平台受控铸造（Key 入金确认 / 托管发放 / 奖励）
    function mintTo(address to, uint256 amount) external onlyOwner whenNotPaused;

    // 兑出（可选，金库余额上限保护）
    function redeem(uint256 creditAmount) external nonReentrant;

    // 视图
    function totalMintedOf(address) external view returns (uint256);  // 等级弱参考
    function totalBurnedOf(address) external view returns (uint256);

    // 事件
    event CreditMinted(address indexed to, uint256 amount, uint8 channel);
    event CreditRedeemed(address indexed from, uint256 amount);
}
```

**设计要点**：
- **链上只发生两件事**：充值铸造（通道 1 用户自助 / 通道 2-3 平台受控）、转账（自托管转移）——消耗在服务端（方案 A 零 gas 核心）
- **铸造即负债**：Credit 可流通/兑出，因此平台受控铸造（mintTo）仅在服务确认后执行（Key 入金延迟确认制、托管发放按实收）
- 汇率 owner 可调；测试网固定汇率，主网可加 Chainlink oracle
- 平台费参数化；ETH 直接进金库（treasury）
- 安全：CEI 顺序、ReentrancyGuard、Pausable、金库提款 onlyOwner；无代理、无自毁（保持简单可审计）

### 3.2 会员徽章（复用 CinaBadge + 新等级徽章）

- 现有 5 种成就徽章保留（Early Minter / Whitelist Member / Diamond Holder / Event Ticket / VIP Member）
- 新增 5 种等级徽章（soulbound，不可转让防交易等级）：

| 等级徽章 ID | 名称 | 累计消耗门槛 |
|---|---|---|
| 100 | Bronze 青铜 | 1 万 Credit |
| 101 | Silver 白银 | 10 万 Credit |
| 102 | Gold 黄金 | 100 万 Credit |
| 103 | Diamond 钻石 | 1000 万 Credit |
| 104 | Whale 巨鲸 | 1 亿 Credit |

> 注：CinaBadge 自定义徽章 ID 从 100 起（`nextCustomBadgeId = 100`），故等级徽章为 100-104。

- 等级判定在服务端（累计消耗是服务端权威数据），达标后由平台调用 CinaBadge.mint 发放——链上无需自动升级逻辑
- 徽章作为链上凭证：可展示、可成就体系联动（与现有 Dashboard/Badges 页无缝衔接）

### 3.3 与现有合约的关系

- CinaNFT（ERC-721 主藏品）与 CinaCredit 独立——CinaNFT 定位从"主藏品"转为"高级会员凭证/收藏品"（可选：持有 N 枚 CinaNFT 解锁额外权益，与 Diamond Holder 徽章联动）
- CinaBadge（ERC-1155）扩展承担等级徽章，不改变现有 ABI（沿用 mint 接口）
- 全部继续部署在 Base Sepolia（新 CinaCredit 合约），主网迁移时同构部署

---

## 4. 计量与对账（服务端核心）

### 4.1 服务端账本（Worker KV/D1，按计费地址）

```json
{
  "address": "0x...",
  "onchainBalance": "100000",      // 链上余额快照（事件索引更新）
  "committedUsage": "30000",       // 已承诺消耗（服务端计量）
  "usable": "70000",               // onchainBalance − committedUsage
  "cumulativeSpend": "30000",      // 累计消耗（会员等级依据）
  "tier": "bronze",                // 缓存等级
  "apiKeys": ["sk-xxx-hash"],      // 绑定 API Key（哈希存储）
  "pendingCredits": "50000"        // Key 入金待确认额度
}
```

### 4.2 计量流程（每次 API 调用）

1. 校验 API Key → 解析计费地址（Key 绑定地址，SIWE 注册；托管账户绑 Key 直接关联 DB 账户）
2. 查可用额度：`usable = onchainBalance − committedUsage`；不足 → `429 Credit Insufficient`
3. 路由到托管 key 池（优先用户自供 key，其次共享池）
4. 按模型定价表计 token 数 → 扣减 committedUsage（服务端，0 gas）
5. 异步确认：事件索引器同步链上余额；key 消耗确认（供 Key 入金结算）

### 4.3 事件索引器（Worker 定时轮询）

- 轮询 CinaCredit 合约 `Transfer` 事件（含 mintTo 的 mint 事件）
- 转入/转出/铸造 → 更新 onchainBalance 快照（转出立即降额，防超花）
- 测试网阶段轮询（如每 30s）足够；主网阶段可升级为 Webhook 索引服务或第三方索引

### 4.4 对账铁律

- 两条消耗路径（链上转账 / 服务端消耗）都必须反映在账本中
- 公式唯一且不可绕过：任何 API 调用前校验 `usable > 0`
- 转出后若 committedUsage > 链上余额：该地址额度为 0，直到重新充值（拒绝负额度）

---

## 5. 会员等级体系

| 等级 | 门槛（累计消耗） | 权益 | 徽章 |
|---|---|---|---|
| Free | 0 | 基础速率限制 | — |
| Bronze | 1 万 | 95 折、限速 ×2 | #100 |
| Silver | 10 万 | 9 折、限速 ×5 | #101 |
| Gold | 100 万 | 85 折、专属队列 | #102 |
| Diamond | 1000 万 | 8 折、专属模型+客服 | #103 |
| Whale | 1 亿 | 定制合同、白名单新模型 | #104 |

- 折扣在服务端定价表应用：消耗按原始 token 数计量，折扣在扣费金额生效
- 速率限制服务端执行；等级变化实时生效（服务端账本判定）
- 徽章达标由平台铸造发放（soulbound）；等级徽章与成就徽章并行

---

## 6. 双轨账户 + 三种铸造通道

### 6.1 账户模型

- **自托管**：钱包直接持有 CinaCredit → API Key 绑定地址（SIWE 已有）→ 链上余额即额度；Credit 可自由转让（事件索引实时反映）
- **托管**：平台热钱包池持有（单池 + DB 记账，避免每用户一个钱包的 gas 成本）→ API Key 直接绑定托管账户；提现 = 平台从池中转出到用户钱包（链上可查）

### 6.2 铸造通道总表

| 通道 | 触发方 | 合约接口 | 时机 | 信用风险 |
|---|---|---|---|---|
| ETH/USDC 充值 | 用户自助 | `mintWithEth()` payable | 即时 | 无（实收实铸） |
| Key 入金 | 平台（验证+确认后） | `mintTo()` onlyOwner | key 被调用确认后 | 零（先服务后铸造） |
| 托管发放/奖励 | 平台 | `mintTo()` onlyOwner | 管理操作 | 平台承担 |

### 6.3 Key 入金通道（延迟确认制）

```
用户 A 提交 key + 申报兑换额度
   │
   ▼
平台测试调用验证 key 有效性（无效/吊销 → 拒绝，pending 作废）
   │
   ▼
key 加密存储入托管池（Worker secret，哈希登记）→ A 获得 pending 记录
   │
   ▼
key 被 API 调用且确认消耗（服务端计量确认，逐笔累计）
   │
   ▼
累计确认消耗 ≥ 申报额度 → 平台调用 mintTo(A, 确认额度) 完成铸造
```

设计要点：
- **铸造 = 平台负债确认**：平台只在 key 真实提供服务后铸造，杜绝坏账
- 申报额度设上限（防滥用，如单 key 申报上限可在后台配置）
- key 明文仅存平台加密存储（Worker secret / 加密 KV），对外只暴露哈希
- 用户可随时查看 pending 状态与确认进度（前端 /keys 页）

---

## 7. 前端与管理后台

### 7.1 新增页面（现有 DApp 扩展）

| 页面 | 功能 |
|---|---|
| `/credits` | 充值：连接钱包 → 输入金额 → 显示汇率/平台费/到账 Credit → mintWithEth |
| `/keys` | Key 入金：提交 API key + 申报额度 → pending 进度条 → 历史记录 |
| `/dashboard`（扩展） | 余额、累计消耗、可用额度、等级进度条、最近消耗明细 |
| `/settings` API Keys | SIWE 绑定地址 → 生成/吊销 API Key（哈希存储） |
| 管理后台 `/admin`（扩展） | 汇率/平台费设置、定价表、等级阈值、Key 验证与发放、托管账户管理 |

### 7.2 定价表（服务端配置）

按模型/接口定价（如每千 token 单价），服务端可灰度调整；折扣按等级应用。

---

## 8. 部署路径（M1 → M3 → 主网）

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **M1 MVP** | CinaCredit 部署（mintWithEth + mintTo + 汇率/金库/平台费）→ 计量网关（API Key 校验 + 服务端账本 + 429）→ 充值页 → 管理后台汇率/发放 | 用户可充值 → 调用 API → 余额扣减 → 用尽 429 ✅ 已完成（2026-08-04，M1 commit 分支 feat/credit-billing-m1） |
| **M2** | 事件索引对账 + 托管账户（热钱包池 + DB） + 会员等级（累计消耗 → 等级 → 徽章发放） | 转账/转出实时反映额度；等级达标自动发徽章 |
| **M3** | Key 入金通道（验证/池化/确认铸造）+ 定价表细分 + 消耗明细报表 + **兑出（redeem，金库余额上限保护）** | key 提供者可获得 Credit；用户可兑出；平台可审计 |
| **主网** | 合约审计（外部审计机构）→ 汇率 oracle → Base 主网部署 → 前端切链 | 真实资金充值/扣费/兑出闭环 |

---

## 9. 非目标（YAGNI，本轮不做）

- 每次调用实时上链扣费（gas 不可行）
- 法币支付通道（Stripe 等）与 KYC
- Credit 的 DEX 流动性 / 做市
- 多链部署与跨链桥
- 订阅式会员（后续可叠加，架构已预留）
- 链上自动等级判定（等级数据在服务端，链上仅凭证）

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 用户转出余额后服务端未同步 → 超花 | 事件索引器 + 公式铁律；转出后 usable 立即为 0 |
| Key 提供方申报虚高额度 | 延迟确认制（先服务后铸造）+ 申报上限 + 验证 |
| Key 池 key 被盗 | 加密存储 + 哈希登记 + 定期轮换 + 限速 |
| 汇率波动（主网） | oracle + 汇率调整冷却期 |
| 托管池单点 | 热钱包限额 + 定期冷转 + 多签（主网阶段） |
