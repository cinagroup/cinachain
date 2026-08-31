import { adminZh } from "./admin"
import { integrationZh } from "./integration"

// 中文简体字典 — 与 en.ts 的 key 一一对应。
// 翻译保持简短、技术感，与品牌语调一致。
export const zh: Record<string, string> = {
  ...adminZh,
  ...integrationZh,
  // ── Header nav ──
  "nav.explore": "探索",
  "nav.mint": "铸造",
  "nav.mintBatch": "批量铸造",
  "nav.collections": "合集",
  "nav.exchange": "兑换",
  "nav.dashboard": "仪表盘",
  "nav.integration": "集成",
  "nav.documentation": "文档",
  "nav.primary": "主导航",
  "nav.openMenu": "打开导航菜单",
  "nav.menuTitle": "导航菜单",
  "nav.homeAria": "CinaChain 首页",
  "nav.skipToContent": "跳至主要内容",
  "nav.connectWallet": "连接钱包",
  "nav.signOut": "退出登录",

  // ── 身份中心 ──
  "identity.title": "身份",
  "identity.description": "集中管理 CinaSeek 账户与链上钱包。",
  "identity.accountTitle": "CinaSeek 账户",
  "identity.accountDescription":
    "前往 CinaSeek Accounts 验证身份；首次使用会自动创建账户。",
  "identity.walletTitle": "链上钱包",
  "identity.walletDescription": "连接钱包以进行铸造、兑换及其他链上操作。",
  "identity.signedIn": "已登录",
  "identity.signedOut": "未登录",
  "identity.continueWithCinaSeek": "使用 CinaSeek 继续",
  "identity.returnToCinaSeek": "返回 CinaSeek",
  "identity.signOutAccount": "退出账户",
  "identity.signInUnavailable": "登录暂不可用",
  "identity.manageWallet": "管理钱包",
  "identity.independentNote":
    "账户登录与钱包连接相互独立，你可以明确控制每项操作使用的身份。",
  "identity.statusLabel": "账户：{account}。钱包：{wallet}。",

  // ── Dashboard sidebar ──
  "sidebar.backToSite": "返回首页",
  "sidebar.user": "用户",
  "sidebar.admin": "管理",
  "sidebar.overview": "总览",
  "sidebar.myNfts": "我的 NFT",
  "sidebar.badges": "徽章",
  "sidebar.favorites": "收藏",
  "sidebar.account": "账户",
  "sidebar.credits": "积分",
  "sidebar.keyIngress": "密钥接入",
  "sidebar.whitelist": "白名单",
  "sidebar.statistics": "统计",
  "sidebar.contract": "合约",
  "sidebar.billing": "计费",

  // ── Common actions ──
  "action.connectWallet": "连接钱包",
  "action.signOut": "退出登录",
  "action.viewAll": "查看全部",
  "action.mint": "铸造",
  "action.cancel": "取消",
  "action.confirm": "确认",
  "action.close": "关闭",
  "action.save": "保存",
  "action.loading": "加载中...",
  "action.retry": "重试",

  // ── Common status ──
  "status.connected": "已连接",
  "status.disconnected": "未连接",
  "status.wrongNetwork": "网络错误",
  "status.paused": "已暂停",
  "status.active": "正常",
  "status.inProgress": "进行中",
  "status.completed": "已完成",
  "status.failed": "失败",
  "status.success": "成功",
  "status.unavailable": "暂不可用",
  "status.live": "已上线",
  "status.beta": "测试版",
  "status.comingSoon": "即将推出",
  "status.done": "已完成",

  // ── Home page ──
  "home.heroTitle": "拥有链上未来。",
  "home.buildingOn": "构建于 {network}",
  "home.heroDescription":
    "运行于 {network} 的全栈 Web3 生态——涵盖 NFT 平台、徽章系统、免 Gas 交易与边缘基础设施。",
  "home.getStarted": "开始使用",
  "home.exploreCollection": "探索合集",
  "home.exploreNfts": "探索 NFT",
  "home.mintNft": "铸造 NFT",
  "home.statsTitle": "数据一览。",
  "home.statsTotalMinted": "已铸造",
  "home.statsMaxSupply": "最大供应",
  "home.statsMintPrice": "铸造价格",
  "home.statsNetwork": "网络",
  "home.statsLastKnown": "合集统计（最近已知数据）",
  "home.productsEyebrow": "产品",
  "home.productsTitle": "持续成长的生态。",
  "home.productsDescription": "五项产品共享同一套基础设施，并可协同工作。",
  "home.productNftDescription":
    "10,000 件独特藏品，支持白名单和公开铸造阶段，并提供完整枚举能力以接入仪表盘。",
  "home.viewCollection": "查看合集",
  "home.productBadgeDescription":
    "灵魂绑定成就徽章、活动门票与会员等级，支持批量铸造和空投。",
  "home.viewBadges": "查看徽章",
  "home.productMegaDescription":
    "UCINA、MCINA、CINA 三类模板化大型合集，每类拥有数十亿份，并按固定的 1:1000:1,000,000 比率兑换。",
  "home.viewCollections": "查看合集",
  "home.gaslessMinting": "免 Gas 铸造",
  "home.productGaslessDescription":
    "集成 Coinbase 智能钱包，通过通行密钥快速接入；用户无需持有 ETH 即可铸造。",
  "home.tryGasless": "体验免 Gas",
  "home.edgeApi": "边缘 API",
  "home.productApiDescription":
    "白名单验证与 Paymaster 代理运行于 Cloudflare 全球边缘网络。",
  "home.apiStatus": "API 状态",
  "home.infrastructureEyebrow": "基础设施",
  "home.infrastructureTitle": "为扩展而生的测试网技术栈。",
  "home.infrastructureDescription":
    "主网上线前，每一层都在 Base Sepolia 上完成验证。",
  "home.baseDescription":
    "Coinbase 的以太坊二层网络，为 CinaChain 合约和交易提供运行环境。",
  "home.ipfsDescription": "去中心化元数据，并通过三个网关回退保障可靠性。",
  "home.smartWallet": "智能钱包",
  "home.smartWalletDescription":
    "基于通行密钥，无需助记词，并支持免 Gas 交易。",
  "home.cloudflareDescription":
    "Pages 与 Workers 部署至边缘，全球延迟低于 50 毫秒。",
  "home.roadmapEyebrow": "路线图",
  "home.roadmapTitle": "分阶段稳步构建。",
  "home.roadmapDescription": "每个阶段都会先在测试网验证，再进入下一阶段。",
  "home.roadmapInfrastructure": "基础设施",
  "home.roadmapCloudflareDeploy": "部署 Cloudflare Pages",
  "home.roadmapIpfsGateways": "自定义 IPFS 网关",
  "home.roadmapRpcProxy": "RPC 代理 Worker",
  "home.roadmapNftPlatform": "NFT 平台",
  "home.roadmapErc721": "部署 ERC-721 合约",
  "home.roadmapMintWhitelist": "铸造与白名单系统",
  "home.roadmapDashboardExplore": "仪表盘与探索页",
  "home.roadmapAdminBadges": "管理与徽章",
  "home.roadmapAdminPanel": "管理控制台",
  "home.roadmapBadgeSystem": "ERC-1155 徽章系统",
  "home.roadmapGasless": "免 Gas 铸造（CDP）",
  "home.roadmapScale": "扩展生态",
  "home.roadmapUsdc": "USDC Paymaster 集成",
  "home.roadmapMainnet": "主网部署",
  "home.roadmapMarketplace": "市场集成",
  "home.teamEyebrow": "团队",
  "home.teamTitle": "由 cinagroup 构建。",
  "home.teamDescription": "专注于交付真实链上产品的团队。",
  "home.coreTeam": "核心团队",
  "home.brandCommunity": "品牌与社区",
  "home.openSource": "开源",
  "home.poweredByCommunity": "由社区共同驱动",
  "home.ctaTitle": "开始在 CinaChain 上构建",
  "home.ctaDescription": "铸造你的首枚 NFT、赢取徽章并加入生态。",
  "home.mintFirstNft": "铸造首枚 NFT",
  "home.joinDiscord": "加入 Discord",
  "home.poweredBy": "{network} · 由 Cloudflare 提供支持",

  // ── Footer ──
  "footer.builtBy": "由 cinagroup 构建",
  "footer.product": "产品",
  "footer.resources": "资源",
  "footer.company": "公司",
  "footer.integrations": "集成",
  "footer.community": "社区",
  "footer.apiKeys": "API 密钥",
  "footer.signInWithEthereum": "以太坊登录",
  "footer.tagline":
    "运行于 {network}（{stage}）的 NFT 平台，采用 Cloudflare Web3 基础设施。",
  "footer.githubAria": "CinaChain 的 GitHub",
  "footer.xAria": "CinaChain 的 X",
  "footer.discordAria": "CinaChain 的 Discord",
  "footer.allRightsReserved": "保留所有权利。",

  // ── Credits page ──
  "credits.title": "积分",
  "credits.description":
    "CinaCredit 是 cina 生态的结算通证——它同时是你的 API 计费上限和共享密钥市场的收益结算凭证。",
  "credits.yourBalance": "你的余额",
  "credits.totalSupply": "总供应量",
  "credits.howItWorks": "积分如何运作",
  "credits.issuedByTeam": "CinaCredit 由 CinaChain 团队发放",
  "credits.opsIssued": "积分由运营发放。",
  "credits.oneTokenTwoRoles": "一种通证，两种角色。",
  "credits.keepAnEyeOnUsage": "留意用量。",
  "credits.billingLedger": "计费账本",
  "credits.onChainBalance": "链上余额",
  "credits.committedUsage": "已提交用量",
  "credits.usable": "可用",
  "credits.cumulativeSpend": "累计消耗",

  // ── Keys page ──
  "keys.title": "密钥接入",
  "keys.description": "注册和管理 CinaChain 计费系统的 API 密钥。",

  // ── Admin overview ──
  "admin.title": "管理后台",
  "admin.overview": "总览",
  "admin.mintedCount": "已铸造",
  "admin.maxCount": "最大供应",
  "admin.mintPrice": "铸造价格",
  "admin.paused": "已暂停",
  "admin.active": "正常",

  // ── Dashboard overview ──
  "dashboard.welcomeBack": "欢迎回来，",
  "dashboard.ethBalance": "ETH 余额",
  "dashboard.nftsOwned": "持有 NFT",
  "dashboard.cinaChainNfts": "CinaChain NFT",
  "dashboard.collectionProgress": "合集进度",
  "dashboard.totalMinted": "已铸造",
  "dashboard.membershipTier": "会员等级",
  "dashboard.creditSpent": "积分已消耗",
  "dashboard.topTierReached": "已达到最高等级",

  // ── Language switcher ──
  "language.switch": "切换语言",
  "language.select": "选择语言",
  "theme.toggle": "切换主题",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.system": "跟随系统",

  // ── Explore page ──
  "explore.title": "探索",
  "explore.collectionUnavailable": "合集数据不可用",
  "explore.showingLastKnown": "显示最近已知数据",

  // ── Mint page ──
  "mint.title": "铸造",
  "mint.connectWallet": "连接钱包",
  "mint.mintItems": "铸造项目",

  // ── Exchange page ──
  "exchange.title": "兑换",
  "exchange.swapDirection": "兑换方向",

  // ── My NFTs page ──
  "nfts.yourNfts": "我的 NFT",
  "nfts.connectWallet": "连接你的钱包",
  "nfts.collectionSummary": "合集摘要",

  // ── Badges page ──
  "badges.title": "徽章",
  "badges.noBadges": "暂无徽章",

  // ── Favorites page ──
  "favorites.title": "收藏",
  "favorites.noFavorites": "暂无收藏",

  // ── Account page ──
  "account.title": "账户",
  "account.quickLinks": "快捷链接",

  // ── Settings page ──
  "settings.title": "设置",
  "settings.apiKeys": "API 密钥",

  // ── Admin pages ──
  "admin.quickActions": "快捷操作",
  "admin.mintBadges": "铸造徽章",
  "admin.manageWhitelist": "管理白名单",
  "admin.viewStats": "查看统计",
  "admin.contractSettings": "合约设置",
  "admin.billingSettings": "计费设置",
  "admin.badgeTypes": "徽章类型",
  "admin.howItWorks": "工作原理",
  "admin.mintingProgress": "铸造进度",
  "admin.contractInfo": "合约信息",

  // ── Badges page ──
  "badges.connectWallet": "连接你的钱包",
  "badges.connectToView": "连接钱包以查看你的 CinaChain 徽章和成就。",
  "badges.yourBadges": "你的徽章",

  // ── Admin billing ──
  "admin.billingManagement": "计费管理",
  "admin.issueCredit": "发放积分",
  "admin.recipientAddress": "接收地址",
  "admin.emergencyControls": "应急控制",
  "admin.creditOperations": "积分操作",

  // ── 页面通用文案 ──
  "common.viewOn": "在 {explorer} 查看",
  "common.gasless": "免 Gas",
  "auth.required": "需要身份验证",
  "auth.connectWalletTitle": "连接你的钱包",
  "tier.free": "免费",
  "tier.bronze": "青铜",
  "tier.silver": "白银",
  "tier.gold": "黄金",
  "tier.diamond": "钻石",
  "tier.whale": "鲸鱼",

  // ── 管理权限 ──
  "admin.loadingStatus": "正在加载管理员状态...",
  "admin.accessRequired": "需要管理员权限",
  "admin.connectToAccess": "连接钱包以访问管理面板。",
  "admin.accessDenied": "访问被拒绝",
  "admin.notAuthorized": "当前钱包地址无权访问管理面板。",
  "admin.returnHome": "返回首页",

  // ── 仪表盘详情 ──
  "dashboard.tierUnavailable": "会员等级数据暂不可用",
  "dashboard.creditSpentValue": "已使用 {value} 积分",
  "dashboard.creditToTier": "再使用 {value} 积分可升至{tier}",
  "dashboard.badgePending": "待领取徽章：{badges}",
  "dashboard.eligible": "符合资格",
  "dashboard.public": "公开",
  "dashboard.notListed": "不在名单中",
  "dashboard.checkBackLater": "请稍后再查看",
  "dashboard.lastCompleteResponse": "最近一次完整链上响应",
  "dashboard.progressStaleDescription":
    "最新刷新失败，合集进度采用最近一次完整的链上响应。",
  "dashboard.progressUnavailableDescription":
    "合约读取未返回完整结果，暂时无法获取合集进度。",
  "dashboard.showingLastProgress": "正在显示最近已知的合集进度",
  "dashboard.progressUnavailable": "合集进度暂不可用",
  "dashboard.quickActions": "快捷操作",
  "dashboard.viewMyNfts": "查看我的 NFT",
  "dashboard.connectDescription":
    "连接钱包以查看个性化仪表盘、管理 NFT，并使用专属功能。",

  // ── 探索详情 ──
  "explore.eyebrow": "合集",
  "explore.heading": "CinaChain NFT 展厅",
  "explore.description":
    "浏览完整合集。每件 NFT 均存储于 IPFS，并配置多网关容错。",
  "explore.contractNotConfigured":
    "NFT 合约尚未配置。请设置 NEXT_PUBLIC_CINA_NFT_CONTRACT 后查看合集。",
  "explore.readErrorDescription":
    "无法从 Base Sepolia 读取合集，因此不会推断 NFT 数量或空状态。",
  "explore.staleDescription":
    "最新刷新失败，下方展厅采用最近一次完整的链上响应。",
  "explore.emptyTitle": "尚未铸造 NFT。",
  "explore.emptyDescription": "成为第一个铸造 CinaChain NFT 的用户！",
  "explore.showingFirst": "当前显示已铸造 {count} 件 NFT 中的前 100 件。",

  // ── 铸造详情 ──
  "mint.heading": "铸造 CinaChain NFT",
  "mint.connectDescription": "连接钱包以铸造 NFT。",
  "mint.checkingStatus": "正在检查铸造状态...",
  "mint.limitReachedDescription": "此地址已达到铸造上限。",
  "mint.quantityRange": "数量必须介于 1 和 {max} 之间。",
  "mint.noWhitelistProof": "此地址没有可用的白名单证明，请联系 CinaChain 团队。",
  "mint.confirmInWallet": "请在钱包中确认...",
  "mint.confirming": "正在确认...",
  "mint.minting": "正在铸造...",
  "mint.buttonLabel": "铸造 {quantity} 件 NFT",
  "mint.whitelistDescription": "专属白名单铸造现已开放。",
  "mint.publicDescription": "公开铸造现已面向所有人开放。",
  "mint.inactiveDescription": "铸造当前未开放。",
  "mint.batchPrompt": "需要批量铸造徽章？",
  "mint.batchLink": "批量铸造 ERC-1155",
  "mint.whitelistServiceUnavailable":
    "白名单服务暂不可用，当前显示公开铸造状态；白名单铸造可能受影响。",
  "mint.notWhitelisted": "此地址不在白名单中，但仍可按常规价格公开铸造。",
  "mint.details": "铸造详情",
  "mint.whitelistActive": "白名单铸造已开放",
  "mint.publicActive": "公开铸造已开放",
  "mint.notActive": "铸造未开放",
  "mint.whitelistEligible": "你已进入白名单，最多可铸造 {limit} 件 NFT。",
  "mint.publicPrice": "公开铸造已开放，每件价格为 {price} ETH。",
  "mint.inactiveAlert": "铸造当前未开放，请稍后再试。",
  "mint.success": "铸造成功！",
  "mint.quantity": "数量",
  "mint.pricePerNft": "每件 NFT 价格",
  "mint.total": "合计",
  "mint.mintedByYou": "你已铸造",
  "mint.whitelistMintsByYou": "你的白名单铸造数",
  "mint.limitReached": "已达到铸造上限",

  // ── 兑换详情 ──
  "exchange.contractNotConfigured":
    "CinaMega 合约尚未配置。请设置 NEXT_PUBLIC_CINA_MEGA_CONTRACT。",
  "exchange.heading": "兑换 CinaMega",
  "exchange.description":
    "按固定比率在 UCINA、MCINA 和 CINA 之间兑换。兑换为原子操作：源代币销毁与目标代币铸造在同一笔交易中完成。",
  "exchange.fixedRate": "固定比率",
  "exchange.success": "兑换成功！",
  "exchange.youHold": "你持有：UCINA {ucina} · MCINA {mcina} · CINA {cina}",
  "exchange.connectWallet": "连接钱包以进行兑换。",
  "exchange.youGive": "你支付（源代币）",
  "exchange.amount": "数量",
  "exchange.amountAria": "要兑换的 {token} 数量",
  "exchange.insufficientBalance": "余额不足——你持有 {amount} {token}。",
  "exchange.youReceiveDestination": "你将收到（目标代币）",
  "exchange.youReceive": "你将收到",
  "exchange.dustBurned": "已销毁余量：{amount} 单位（向下取整兑换）",
  "exchange.amountTooSmall":
    "数量过小——兑换 1 {destination} 至少需要 {amount} {source}。",
  "exchange.exchanging": "正在兑换...",

  // ── 仪表盘子页 ──
  "nfts.description": "你的 CinaChain NFT 合集。",
  "nfts.totalOwned": "持有 NFT 总数",
  "nfts.readErrorDescription":
    "无法读取此钱包的 NFT 余额或所有权数据，因此不会推断为空合集。",
  "nfts.readErrorTitle": "NFT 所有权数据暂不可用",
  "nfts.staleDescription":
    "最新刷新失败，下方余额与 NFT 来自最近一次完整的链上响应。",
  "nfts.staleTitle": "正在显示最近已知的所有权数据",
  "nfts.loadMore": "加载更多（还有 {count} 件）",
  "nfts.showingOwned": "当前显示持有的 {count} 件 NFT 中的 {shown} 件。",
  "nfts.emptyDescription": "你还没有 CinaChain NFT。",
  "nfts.mintFirst": "铸造你的第一件 NFT",
  "nfts.connectDescription": "连接钱包以查看你的 NFT 合集。",
  "favorites.description": "你保存以便稍后查看的 NFT。",
  "favorites.clearAll": "清除全部",
  "favorites.emptyDescription": "开始探索，并点击心形图标保存你喜欢的 NFT。",
  "badges.description": "收集成就并解锁专属权益。",
  "badges.contractNotConfigured": "徽章合约尚未配置。",
  "badges.configureContract":
    "请设置 NEXT_PUBLIC_CINA_ERC1155_CONTRACT 以启用徽章。",
  "badges.earned": "已获得",
  "badges.earnedSummary": "你已获得 {count} 枚徽章。继续铸造和收集以解锁更多！",
  "badges.owned": "已拥有",
  "badges.loading": "正在加载徽章...",
  "badges.emptyDescription": "铸造 NFT 并参与社区活动，即可获得徽章！",

  // ── 账户详情 ──
  "account.description": "管理钱包与身份验证设置。",
  "account.walletDetails": "已连接钱包的详细信息",
  "account.address": "地址",
  "account.ensName": "ENS 名称",
  "account.ensResolved": "（已解析）",
  "account.noEns": "（无 ENS）",
  "account.network": "网络",
  "account.balance": "余额",
  "account.unsupportedNetwork": "{network}（不支持）",
  "account.unknownNetwork": "未知",
  "account.authentication": "身份验证",
  "account.cinaSeekSso": "CinaSeek Accounts 单点登录",
  "account.cinaSeekStatus": "CinaSeek 账户状态",
  "account.authenticated": "已验证",
  "account.sessionExpires": "会话到期时间：",
  "account.cinaSeekDescription":
    "前往 CinaSeek Accounts，通过邮箱、钱包、Google 或 GitHub 验证。验证后会自动创建新用户，链上钱包连接仍保持独立。",
  "account.openingCinaSeek": "正在打开 CinaSeek...",
  "account.quickLinksDescription": "与你的钱包相关的常用资源",
  "account.mintPage": "铸造页面",
  "account.connectDescription": "连接钱包以查看账户详情、管理设置并使用专属功能。",

  // ── 密钥接入详情 ──
  "keys.connectWalletFirst": "请先连接钱包。",
  "keys.tooShort": "API 密钥过短。",
  "keys.registered": "接入已登记：{id}（{status}）",
  "keys.submitFailed": "提交密钥失败。",
  "keys.ingressDescription": "将 API 密钥共享给平台资源池，使用后即可获得 CinaCredit。",
  "keys.submitTitle": "提交 API 密钥",
  "keys.submitDescription": "密钥会加密存储且绝不外泄；资源池使用后你将获得积分。",
  "keys.model": "模型",
  "keys.declaredAmount": "申报数量（微积分）",
  "keys.submitAction": "提交密钥",
  "keys.recordsTitle": "你的接入记录",
  "keys.recordsDescription": "待处理 / 铸造中 / 已铸造状态",
  "keys.noRecords": "暂无记录。请在上方提交密钥，资源池使用后状态会自动更新。",
  "keys.recordProgress": "{model} · 已确认 {confirmed} / {declared} 微积分",

  // ── 积分详情 ──
  "credits.contractNotConfigured": "积分合约尚未配置，请联系 CinaChain 团队。",
  "credits.connectIntro":
    "CinaCredit 用于 API 计费与市场收益结算。连接钱包以查看余额。",
  "credits.connectDescription": "连接钱包以查看积分余额和使用情况。",
  "credits.pausedDescription":
    "积分操作当前已暂停；转账、铸造与销毁均被冻结。请稍后再试。",
  "credits.balanceDescription": "你的钱包持有的链上 CinaCredit（CINA-C）",
  "credits.creditUnit": "积分",
  "credits.viewContract": "在区块浏览器中查看合约",
  "credits.opsIssuedDescription":
    "团队会向你的钱包地址发放充值积分。如需增加 API 积分，请联系 CinaChain 团队。",
  "credits.twoRolesDescription":
    "余额既是 API 计费上限，也是市场收益在链上结算使用的代币。",
  "credits.usageDescription":
    "API 调用会减少可用积分；下方账本显示链上余额中仍可使用的部分。",
  "credits.ledgerDescription": "针对你的地址的服务端计量（计费 Worker）",
  "credits.ledgerUnavailable": "无法连接计费服务，账本暂不可用。",

  // ── NFT 详情 ──
  "nftDetail.notMintedTitle": "此 NFT 尚未铸造",
  "nftDetail.notMintedDescription":
    "代币 #{tokenId} 尚不存在于链上。成为第一个铸造并永久拥有它的用户。",
  "nftDetail.mintToken": "铸造 NFT #{tokenId}",
  "nftDetail.tokenId": "代币 ID",
  "nftDetail.owner": "所有者",
  "nftDetail.you": "你",
  "nftDetail.description": "说明",
  "nftDetail.attributes": "属性",
  "nftDetail.traits": "{count} 项特征",
  "nftDetail.contractDetails": "合约详情",
  "nftDetail.contractAddress": "合约地址",
  "nftDetail.tokenStandard": "代币标准",
  "nftDetail.blockchain": "区块链",

  // ── 批量铸造 ──
  "batchMint.heading": "批量铸造 ERC-1155",
  "batchMint.connectDescription": "连接钱包以批量铸造。",
  "batchMint.contractNotConfigured": "ERC-1155 合约地址尚未配置。",
  "batchMint.addOneItem": "请至少添加一项。",
  "batchMint.invalidTokenId": "代币 ID“{id}”无效。",
  "batchMint.invalidAmount": "数量“{amount}”必须为正整数。",
  "batchMint.failed": "批量铸造失败。",
  "batchMint.description":
    "在一笔交易中向你的地址铸造多种徽章，适合包含多个变体的合集。",
  "batchMint.note": "提示：",
  "batchMint.ownerOnlyPrefix": "底层合约函数为",
  "batchMint.ownerOnlySuffix": "仅合约所有者的钱包可以执行此操作。",
  "batchMint.success": "批量铸造已确认！",
  "batchMint.waitingConfirmation": "交易已提交，正在等待确认...",
  "batchMint.reverted": "交易已在链上回滚。",
  "batchMint.itemsDescription": "添加多个代币 ID 和数量，在一笔交易中完成铸造。",
  "batchMint.removeItem": "移除项目",
  "batchMint.addItem": "添加项目",
  "batchMint.totalItems": "项目总数",
  "batchMint.totalAmount": "数量合计",
  "batchMint.buttonLabel": "批量铸造 {count} 个项目",

  // ── 大型合集 ──
  "collections.freePublicMint": "免费公开铸造",
  "collections.exchangeOnly": "仅限兑换",
  "collections.description":
    "三个基于模板的大型合集，每个均拥有数十亿份，并通过固定兑换比率相连。",
  "collections.fixedRate": "固定兑换比率",
  "collections.templatesLocked": "模板已锁定——不可更改",
  "collections.templatesPending": "模板待初始化",
  "collections.minted": "铸造成功！",
  "collections.smartAccountNotice":
    "智能账户提示：嵌入式钱包在首次交易前尚未部署到链上。请勿从其他钱包向该地址发送 NFT 或资金，否则资产可能丢失。",
  "collections.mintUcina": "铸造 UCINA",
  "collections.freeMintDescription": "基础单位可免费公开铸造",
  "collections.perAddressCap": "每个地址最多 {amount}",
  "collections.mintingPaused": "铸造已暂停",
  "collections.decreaseAmount": "减少铸造数量",
  "collections.increaseAmount": "增加铸造数量",
  "collections.mintAmount": "铸造 {amount} UCINA",
  "collections.exchangePrompt": "持有 UCINA？可在",
  "collections.exchangePage": "兑换页面将其兑换为 MCINA 和 CINA",
  "collections.ucinaDescription": "基础单位，可免费铸造且供应不限，是进入 Cina 经济的起点。",
  "collections.mcinaDescription": "中间单位，1 MCINA 等于 1,000 UCINA，仅可通过向上兑换获得。",
  "collections.cinaDescription":
    "旗舰单位，1 CINA 等于 1,000 MCINA 或 1,000,000 UCINA，仅可通过兑换获得。",
}
