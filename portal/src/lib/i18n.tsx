import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export const SUPPORTED_LOCALES = [
  "zh",
  "en",
  "ja",
  "ko",
  "ru",
  "es",
  "pt",
  "fr",
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export interface LocaleOption {
  code: Locale
  shortLabel: string
  nativeLabel: string
  htmlLang: string
}

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "zh", shortLabel: "中", nativeLabel: "中文", htmlLang: "zh-CN" },
  { code: "en", shortLabel: "EN", nativeLabel: "English", htmlLang: "en" },
  { code: "ja", shortLabel: "日", nativeLabel: "日本語", htmlLang: "ja" },
  { code: "ko", shortLabel: "한", nativeLabel: "한국어", htmlLang: "ko" },
  { code: "ru", shortLabel: "RU", nativeLabel: "Русский", htmlLang: "ru" },
  { code: "es", shortLabel: "ES", nativeLabel: "Español", htmlLang: "es" },
  { code: "pt", shortLabel: "PT", nativeLabel: "Português", htmlLang: "pt" },
  { code: "fr", shortLabel: "FR", nativeLabel: "Français", htmlLang: "fr" },
]

const HTML_LANG_BY_LOCALE = Object.fromEntries(
  LOCALE_OPTIONS.map(({ code, htmlLang }) => [code, htmlLang])
) as Record<Locale, string>

const en = {
  "meta.title": "CinaChain — Base Sepolia Testnet Beta",
  "meta.description":
    "CinaChain — NFT platform, badge system, mega-collections, and edge-deployed infrastructure on Base Sepolia Testnet.",
  "common.skipToContent": "Skip to content",
  "language.switch": "Change language",
  "language.select": "Select language",
  "theme.toggle": "Toggle theme",
  "theme.select": "Select theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "nav.primary": "Primary",
  "nav.dapp": "DApp",
  "nav.docs": "Docs",
  "nav.collections": "Collections",
  "nav.github": "GitHub",
  "nav.enterDapp": "Enter DApp",
  "aria.home": "CinaChain home",
  "aria.github": "CinaChain on GitHub",
  "aria.discord": "CinaChain on Discord",
  "hero.buildingOn": "Building on {network}",
  "hero.description":
    "A full-stack Web3 ecosystem currently running on {network} — NFT platform, badge system, gasless transactions, and edge-deployed infrastructure.",
  "hero.explore": "Explore NFTs",
  "hero.mint": "Mint NFT",
  "hero.dashboard": "Dashboard",
  "stats.maxSupply": "Max supply",
  "stats.network": "Network",
  "stats.stage": "Stage",
  "status.live": "Live",
  "status.beta": "Beta",
  "status.comingSoon": "Coming soon",
  "status.done": "Done",
  "status.inProgress": "In progress",
  "products.eyebrow": "Products",
  "products.title": "A growing ecosystem.",
  "products.description":
    "Five products built on shared infrastructure, designed to work together.",
  "product.nft.description":
    "10,000 unique collectibles with whitelist + public mint phases. Full enumerable support for dashboard integration.",
  "product.nft.cta": "View collection",
  "product.badge.description":
    "Soulbound achievement badges, event tickets, and membership tiers. Batch minting and airdrop support.",
  "product.badge.cta": "View badges",
  "product.mega.description":
    "Three template-based mega-collections — UCINA, MCINA, CINA — with billions of copies each and a fixed 1:1000:1,000,000 exchange.",
  "product.mega.cta": "View collections",
  "product.gasless.name": "Gasless minting",
  "product.gasless.description":
    "Coinbase Smart Wallet integration in beta, designed for passkey-based onboarding and sponsored mint transactions.",
  "product.gasless.cta": "Try gasless",
  "product.edge.description":
    "Whitelist verification and billing APIs running on Cloudflare's global edge network.",
  "product.edge.cta": "API status",
  "infrastructure.eyebrow": "Infrastructure",
  "infrastructure.title": "A testnet stack built to scale.",
  "infrastructure.description":
    "Every layer is being validated on Base Sepolia before the mainnet launch.",
  "tech.base.description":
    "Coinbase's Ethereum L2 configured for CinaChain contracts and transactions.",
  "tech.ipfs.description":
    "Decentralized metadata with 3-gateway fallback for reliability.",
  "tech.wallet.title": "Smart wallet",
  "tech.wallet.description":
    "Passkey-based wallets. No seed phrases. Gasless transactions.",
  "tech.cloudflare.description":
    "Edge-deployed Pages + Workers for global delivery.",
  "roadmap.eyebrow": "Roadmap",
  "roadmap.title": "Built incrementally.",
  "roadmap.description":
    "Each phase is validated on testnet before the next begins.",
  "roadmap.phase1.title": "Infrastructure",
  "roadmap.phase1.item1": "Cloudflare Pages deploy",
  "roadmap.phase1.item2": "Custom IPFS gateways",
  "roadmap.phase1.item3": "Edge Worker foundation",
  "roadmap.phase2.title": "NFT platform",
  "roadmap.phase2.item1": "ERC-721 contract deployed",
  "roadmap.phase2.item2": "Mint + whitelist system",
  "roadmap.phase2.item3": "Dashboard & explore",
  "roadmap.phase3.title": "Admin & badges",
  "roadmap.phase3.item1": "Admin control panel",
  "roadmap.phase3.item2": "ERC-1155 badge system",
  "roadmap.phase3.item3": "Smart wallet onboarding",
  "roadmap.phase4.title": "Scale & expand",
  "roadmap.phase4.item1": "Paymaster production hardening",
  "roadmap.phase4.item2": "Branded RPC proxy hardening",
  "roadmap.phase4.item3": "Mainnet deployment",
  "roadmap.phase4.item4": "Marketplace integration",
  "team.eyebrow": "Team",
  "team.title": "Built by cinagroup.",
  "team.description": "A team focused on shipping real products on-chain.",
  "team.coreRole": "Core team",
  "team.brandRole": "Brand & community",
  "team.openSource": "Open source",
  "team.openSourceRole": "Powered by the community",
  "cta.title": "Start building on CinaChain",
  "cta.description":
    "Mint your first NFT, earn badges, and join the ecosystem.",
  "cta.mint": "Mint your first NFT",
  "cta.discord": "Join Discord",
  "cta.powered": "{network} · Powered by Cloudflare",
  "footer.description":
    "A full-stack Web3 ecosystem on Base Sepolia Testnet — NFT platform, badge system, mega-collections, and edge-deployed infrastructure.",
  "footer.products": "Products",
  "footer.resources": "Resources",
  "footer.community": "Community",
  "footer.exchange": "Exchange",
  "footer.mint": "Mint",
  "footer.dashboard": "Dashboard",
  "footer.apiStatus": "API status",
  "footer.builtOn": "Built on",
  "footer.poweredBy": "Powered by",
  "footer.stage": "Base Sepolia Testnet · Beta",
} as const

export type TranslationKey = keyof typeof en
type Dictionary = Record<TranslationKey, string>

const zh: Dictionary = {
  "meta.title": "CinaChain — Base Sepolia 测试网 Beta",
  "meta.description":
    "CinaChain——运行于 Base Sepolia 测试网的 NFT 平台、徽章系统、超级合集与边缘基础设施。",
  "common.skipToContent": "跳至主要内容",
  "language.switch": "切换语言",
  "language.select": "选择语言",
  "theme.toggle": "切换主题",
  "theme.select": "选择主题",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.system": "跟随系统",
  "nav.primary": "主导航",
  "nav.dapp": "DApp",
  "nav.docs": "文档",
  "nav.collections": "合集",
  "nav.github": "GitHub",
  "nav.enterDapp": "进入 DApp",
  "aria.home": "CinaChain 首页",
  "aria.github": "CinaChain GitHub",
  "aria.discord": "CinaChain Discord",
  "hero.buildingOn": "构建于 {network}",
  "hero.description":
    "目前运行于 {network} 的全栈 Web3 生态——涵盖 NFT 平台、徽章系统、免 Gas 交易与边缘部署基础设施。",
  "hero.explore": "探索 NFT",
  "hero.mint": "铸造 NFT",
  "hero.dashboard": "仪表盘",
  "stats.maxSupply": "最大供应量",
  "stats.network": "网络",
  "stats.stage": "阶段",
  "status.live": "已上线",
  "status.beta": "测试版",
  "status.comingSoon": "即将推出",
  "status.done": "已完成",
  "status.inProgress": "进行中",
  "products.eyebrow": "产品",
  "products.title": "持续成长的生态。",
  "products.description": "五款产品共享基础设施，协同设计、彼此联动。",
  "product.nft.description":
    "10,000 枚独特藏品，支持白名单与公开铸造阶段，并提供完整枚举能力以集成仪表盘。",
  "product.nft.cta": "查看藏品",
  "product.badge.description":
    "灵魂绑定成就徽章、活动票券与会员等级，支持批量铸造和空投。",
  "product.badge.cta": "查看徽章",
  "product.mega.description":
    "UCINA、MCINA、CINA 三个模板化超级合集，每个均拥有数十亿份副本，并采用固定 1:1000:1,000,000 兑换比例。",
  "product.mega.cta": "查看合集",
  "product.gasless.name": "免 Gas 铸造",
  "product.gasless.description":
    "Coinbase Smart Wallet 测试版集成，面向通行密钥入门与赞助式铸造交易。",
  "product.gasless.cta": "体验免 Gas",
  "product.edge.description":
    "白名单验证与计费 API 运行在 Cloudflare 全球边缘网络。",
  "product.edge.cta": "API 状态",
  "infrastructure.eyebrow": "基础设施",
  "infrastructure.title": "为扩展而构建的测试网技术栈。",
  "infrastructure.description":
    "主网上线前，每一层都在 Base Sepolia 上完成验证。",
  "tech.base.description":
    "为 CinaChain 合约与交易配置的 Coinbase 以太坊二层网络。",
  "tech.ipfs.description": "去中心化元数据，配备三网关回退以提升可靠性。",
  "tech.wallet.title": "智能钱包",
  "tech.wallet.description": "基于通行密钥，无助记词，支持免 Gas 交易。",
  "tech.cloudflare.description":
    "通过边缘部署的 Pages + Workers 实现全球交付。",
  "roadmap.eyebrow": "路线图",
  "roadmap.title": "循序构建。",
  "roadmap.description": "每个阶段先在测试网上验证，再进入下一阶段。",
  "roadmap.phase1.title": "基础设施",
  "roadmap.phase1.item1": "Cloudflare Pages 部署",
  "roadmap.phase1.item2": "自定义 IPFS 网关",
  "roadmap.phase1.item3": "边缘 Worker 基础",
  "roadmap.phase2.title": "NFT 平台",
  "roadmap.phase2.item1": "ERC-721 合约已部署",
  "roadmap.phase2.item2": "铸造与白名单系统",
  "roadmap.phase2.item3": "仪表盘与探索页",
  "roadmap.phase3.title": "管理与徽章",
  "roadmap.phase3.item1": "管理控制台",
  "roadmap.phase3.item2": "ERC-1155 徽章系统",
  "roadmap.phase3.item3": "智能钱包入门",
  "roadmap.phase4.title": "扩展与增长",
  "roadmap.phase4.item1": "Paymaster 生产强化",
  "roadmap.phase4.item2": "品牌 RPC 代理强化",
  "roadmap.phase4.item3": "主网部署",
  "roadmap.phase4.item4": "市场集成",
  "team.eyebrow": "团队",
  "team.title": "由 cinagroup 构建。",
  "team.description": "专注于交付真实链上产品的团队。",
  "team.coreRole": "核心团队",
  "team.brandRole": "品牌与社区",
  "team.openSource": "开源",
  "team.openSourceRole": "由社区共同驱动",
  "cta.title": "开始在 CinaChain 上构建",
  "cta.description": "铸造你的首枚 NFT、赢取徽章并加入生态。",
  "cta.mint": "铸造首枚 NFT",
  "cta.discord": "加入 Discord",
  "cta.powered": "{network} · 由 Cloudflare 提供支持",
  "footer.description":
    "运行于 Base Sepolia 测试网的全栈 Web3 生态——NFT 平台、徽章系统、超级合集与边缘部署基础设施。",
  "footer.products": "产品",
  "footer.resources": "资源",
  "footer.community": "社区",
  "footer.exchange": "兑换",
  "footer.mint": "铸造",
  "footer.dashboard": "仪表盘",
  "footer.apiStatus": "API 状态",
  "footer.builtOn": "构建于",
  "footer.poweredBy": "技术支持",
  "footer.stage": "Base Sepolia 测试网 · 测试版",
}

const ja: Dictionary = {
  "meta.title": "CinaChain — Base Sepolia テストネット Beta",
  "meta.description":
    "CinaChain — Base Sepolia テストネット上のNFTプラットフォーム、バッジシステム、メガコレクション、エッジインフラ。",
  "common.skipToContent": "メインコンテンツへ移動",
  "language.switch": "言語を変更",
  "language.select": "言語を選択",
  "theme.toggle": "テーマを切り替え",
  "theme.select": "テーマを選択",
  "theme.light": "ライト",
  "theme.dark": "ダーク",
  "theme.system": "システム",
  "nav.primary": "メインナビゲーション",
  "nav.dapp": "DApp",
  "nav.docs": "ドキュメント",
  "nav.collections": "コレクション",
  "nav.github": "GitHub",
  "nav.enterDapp": "DAppを開く",
  "aria.home": "CinaChain ホーム",
  "aria.github": "CinaChain の GitHub",
  "aria.discord": "CinaChain の Discord",
  "hero.buildingOn": "{network} 上で構築",
  "hero.description":
    "現在 {network} で稼働するフルスタックWeb3エコシステム。NFTプラットフォーム、バッジ、ガスレス取引、エッジインフラを提供します。",
  "hero.explore": "NFTを探す",
  "hero.mint": "NFTをミント",
  "hero.dashboard": "ダッシュボード",
  "stats.maxSupply": "最大供給量",
  "stats.network": "ネットワーク",
  "stats.stage": "段階",
  "status.live": "公開中",
  "status.beta": "ベータ",
  "status.comingSoon": "近日公開",
  "status.done": "完了",
  "status.inProgress": "進行中",
  "products.eyebrow": "プロダクト",
  "products.title": "成長し続けるエコシステム。",
  "products.description": "共通インフラ上で連携する5つのプロダクト。",
  "product.nft.description":
    "10,000点のユニークなコレクティブル。許可リストと公開ミント段階、ダッシュボード統合向けの完全な列挙機能を備えます。",
  "product.nft.cta": "コレクションを見る",
  "product.badge.description":
    "譲渡不可の実績バッジ、イベントチケット、会員階層。バッチミントとエアドロップに対応します。",
  "product.badge.cta": "バッジを見る",
  "product.mega.description":
    "UCINA、MCINA、CINAの3つのテンプレート型メガコレクション。各数十億コピー、固定1:1000:1,000,000交換に対応します。",
  "product.mega.cta": "コレクションを見る",
  "product.gasless.name": "ガスレスミント",
  "product.gasless.description":
    "パスキーによるオンボーディングとスポンサー付きミント向けのCoinbase Smart Walletベータ統合。",
  "product.gasless.cta": "ガスレスを試す",
  "product.edge.description":
    "許可リスト検証と課金APIをCloudflareのグローバルエッジで実行します。",
  "product.edge.cta": "APIステータス",
  "infrastructure.eyebrow": "インフラストラクチャ",
  "infrastructure.title": "拡張を見据えたテストネットスタック。",
  "infrastructure.description":
    "メインネット公開前に全レイヤーをBase Sepoliaで検証します。",
  "tech.base.description":
    "CinaChainのコントラクトと取引向けに構成したCoinbaseのEthereum L2。",
  "tech.ipfs.description":
    "3つのゲートウェイへフォールバックする信頼性の高い分散メタデータ。",
  "tech.wallet.title": "スマートウォレット",
  "tech.wallet.description": "パスキー方式。シードフレーズ不要。ガスレス取引。",
  "tech.cloudflare.description":
    "エッジ配置のPages + Workersでグローバル配信。",
  "roadmap.eyebrow": "ロードマップ",
  "roadmap.title": "段階的に構築。",
  "roadmap.description": "各フェーズをテストネットで検証してから次へ進みます。",
  "roadmap.phase1.title": "インフラストラクチャ",
  "roadmap.phase1.item1": "Cloudflare Pagesのデプロイ",
  "roadmap.phase1.item2": "カスタムIPFSゲートウェイ",
  "roadmap.phase1.item3": "エッジWorker基盤",
  "roadmap.phase2.title": "NFTプラットフォーム",
  "roadmap.phase2.item1": "ERC-721コントラクトをデプロイ",
  "roadmap.phase2.item2": "ミント＋許可リストシステム",
  "roadmap.phase2.item3": "ダッシュボードと探索",
  "roadmap.phase3.title": "管理とバッジ",
  "roadmap.phase3.item1": "管理コントロールパネル",
  "roadmap.phase3.item2": "ERC-1155バッジシステム",
  "roadmap.phase3.item3": "スマートウォレットの導入",
  "roadmap.phase4.title": "拡張と成長",
  "roadmap.phase4.item1": "Paymasterの本番強化",
  "roadmap.phase4.item2": "ブランドRPCプロキシの強化",
  "roadmap.phase4.item3": "メインネット展開",
  "roadmap.phase4.item4": "マーケットプレイス統合",
  "team.eyebrow": "チーム",
  "team.title": "cinagroupが構築。",
  "team.description": "実用的なオンチェーン製品の提供に集中するチームです。",
  "team.coreRole": "コアチーム",
  "team.brandRole": "ブランド＆コミュニティ",
  "team.openSource": "オープンソース",
  "team.openSourceRole": "コミュニティが支援",
  "cta.title": "CinaChainで構築を始める",
  "cta.description":
    "最初のNFTをミントし、バッジを獲得してエコシステムに参加しましょう。",
  "cta.mint": "最初のNFTをミント",
  "cta.discord": "Discordに参加",
  "cta.powered": "{network} · Cloudflareを利用",
  "footer.description":
    "Base Sepoliaテストネット上のフルスタックWeb3エコシステム。NFT、バッジ、メガコレクション、エッジインフラを提供します。",
  "footer.products": "プロダクト",
  "footer.resources": "リソース",
  "footer.community": "コミュニティ",
  "footer.exchange": "交換",
  "footer.mint": "ミント",
  "footer.dashboard": "ダッシュボード",
  "footer.apiStatus": "APIステータス",
  "footer.builtOn": "構築先",
  "footer.poweredBy": "提供",
  "footer.stage": "Base Sepolia テストネット · ベータ",
}

const ko: Dictionary = {
  "meta.title": "CinaChain — Base Sepolia 테스트넷 베타",
  "meta.description":
    "CinaChain — Base Sepolia 테스트넷의 NFT 플랫폼, 배지 시스템, 메가 컬렉션 및 엣지 인프라.",
  "common.skipToContent": "본문으로 건너뛰기",
  "language.switch": "언어 변경",
  "language.select": "언어 선택",
  "theme.toggle": "테마 전환",
  "theme.select": "테마 선택",
  "theme.light": "라이트",
  "theme.dark": "다크",
  "theme.system": "시스템",
  "nav.primary": "주요 탐색",
  "nav.dapp": "DApp",
  "nav.docs": "문서",
  "nav.collections": "컬렉션",
  "nav.github": "GitHub",
  "nav.enterDapp": "DApp 열기",
  "aria.home": "CinaChain 홈",
  "aria.github": "CinaChain GitHub",
  "aria.discord": "CinaChain Discord",
  "hero.buildingOn": "{network} 기반",
  "hero.description":
    "현재 {network}에서 운영되는 풀스택 Web3 생태계로 NFT 플랫폼, 배지 시스템, 가스리스 거래 및 엣지 인프라를 제공합니다.",
  "hero.explore": "NFT 탐색",
  "hero.mint": "NFT 민팅",
  "hero.dashboard": "대시보드",
  "stats.maxSupply": "최대 공급량",
  "stats.network": "네트워크",
  "stats.stage": "단계",
  "status.live": "운영 중",
  "status.beta": "베타",
  "status.comingSoon": "출시 예정",
  "status.done": "완료",
  "status.inProgress": "진행 중",
  "products.eyebrow": "제품",
  "products.title": "성장하는 생태계.",
  "products.description":
    "공유 인프라에서 함께 작동하도록 설계된 다섯 가지 제품입니다.",
  "product.nft.description":
    "화이트리스트와 공개 민팅 단계를 갖춘 10,000개의 고유 수집품. 대시보드 통합을 위한 완전한 열거 기능을 지원합니다.",
  "product.nft.cta": "컬렉션 보기",
  "product.badge.description":
    "소울바운드 업적 배지, 이벤트 티켓 및 멤버십 등급. 일괄 민팅과 에어드롭을 지원합니다.",
  "product.badge.cta": "배지 보기",
  "product.mega.description":
    "UCINA, MCINA, CINA 세 가지 템플릿 기반 메가 컬렉션. 각각 수십억 개의 사본과 고정 1:1000:1,000,000 교환을 제공합니다.",
  "product.mega.cta": "컬렉션 보기",
  "product.gasless.name": "가스리스 민팅",
  "product.gasless.description":
    "패스키 온보딩과 후원 민팅 거래를 위한 Coinbase Smart Wallet 베타 통합입니다.",
  "product.gasless.cta": "가스리스 체험",
  "product.edge.description":
    "화이트리스트 검증 및 결제 API가 Cloudflare 글로벌 엣지 네트워크에서 실행됩니다.",
  "product.edge.cta": "API 상태",
  "infrastructure.eyebrow": "인프라",
  "infrastructure.title": "확장을 위해 구축된 테스트넷 스택.",
  "infrastructure.description":
    "메인넷 출시 전에 모든 계층을 Base Sepolia에서 검증합니다.",
  "tech.base.description":
    "CinaChain 계약과 거래에 맞게 구성된 Coinbase의 Ethereum L2입니다.",
  "tech.ipfs.description":
    "안정성을 위한 3개 게이트웨이 폴백을 갖춘 탈중앙화 메타데이터입니다.",
  "tech.wallet.title": "스마트 지갑",
  "tech.wallet.description": "패스키 기반. 시드 문구 없음. 가스리스 거래.",
  "tech.cloudflare.description":
    "엣지 배포 Pages + Workers로 전 세계에 제공합니다.",
  "roadmap.eyebrow": "로드맵",
  "roadmap.title": "단계적으로 구축.",
  "roadmap.description":
    "각 단계를 테스트넷에서 검증한 뒤 다음 단계로 진행합니다.",
  "roadmap.phase1.title": "인프라",
  "roadmap.phase1.item1": "Cloudflare Pages 배포",
  "roadmap.phase1.item2": "사용자 지정 IPFS 게이트웨이",
  "roadmap.phase1.item3": "엣지 Worker 기반",
  "roadmap.phase2.title": "NFT 플랫폼",
  "roadmap.phase2.item1": "ERC-721 계약 배포",
  "roadmap.phase2.item2": "민팅 + 화이트리스트 시스템",
  "roadmap.phase2.item3": "대시보드 및 탐색",
  "roadmap.phase3.title": "관리 및 배지",
  "roadmap.phase3.item1": "관리 제어판",
  "roadmap.phase3.item2": "ERC-1155 배지 시스템",
  "roadmap.phase3.item3": "스마트 지갑 온보딩",
  "roadmap.phase4.title": "확장 및 성장",
  "roadmap.phase4.item1": "Paymaster 프로덕션 강화",
  "roadmap.phase4.item2": "브랜드 RPC 프록시 강화",
  "roadmap.phase4.item3": "메인넷 배포",
  "roadmap.phase4.item4": "마켓플레이스 통합",
  "team.eyebrow": "팀",
  "team.title": "cinagroup이 구축했습니다.",
  "team.description": "실제 온체인 제품 출시에 집중하는 팀입니다.",
  "team.coreRole": "핵심 팀",
  "team.brandRole": "브랜드 및 커뮤니티",
  "team.openSource": "오픈 소스",
  "team.openSourceRole": "커뮤니티의 힘으로 운영",
  "cta.title": "CinaChain에서 구축 시작",
  "cta.description": "첫 NFT를 민팅하고 배지를 획득해 생태계에 참여하세요.",
  "cta.mint": "첫 NFT 민팅",
  "cta.discord": "Discord 참여",
  "cta.powered": "{network} · Cloudflare 제공",
  "footer.description":
    "Base Sepolia 테스트넷의 풀스택 Web3 생태계로 NFT, 배지, 메가 컬렉션 및 엣지 인프라를 제공합니다.",
  "footer.products": "제품",
  "footer.resources": "리소스",
  "footer.community": "커뮤니티",
  "footer.exchange": "교환",
  "footer.mint": "민팅",
  "footer.dashboard": "대시보드",
  "footer.apiStatus": "API 상태",
  "footer.builtOn": "기반",
  "footer.poweredBy": "제공",
  "footer.stage": "Base Sepolia 테스트넷 · 베타",
}

const ru: Dictionary = {
  "meta.title": "CinaChain — бета в тестовой сети Base Sepolia",
  "meta.description":
    "CinaChain — NFT-платформа, система бейджей, мегаколлекции и периферийная инфраструктура в тестовой сети Base Sepolia.",
  "common.skipToContent": "Перейти к содержимому",
  "language.switch": "Сменить язык",
  "language.select": "Выберите язык",
  "theme.toggle": "Переключить тему",
  "theme.select": "Выберите тему",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная",
  "theme.system": "Системная",
  "nav.primary": "Основная навигация",
  "nav.dapp": "DApp",
  "nav.docs": "Документация",
  "nav.collections": "Коллекции",
  "nav.github": "GitHub",
  "nav.enterDapp": "Открыть DApp",
  "aria.home": "Главная CinaChain",
  "aria.github": "CinaChain в GitHub",
  "aria.discord": "CinaChain в Discord",
  "hero.buildingOn": "Работает на {network}",
  "hero.description":
    "Полноценная экосистема Web3 в сети {network}: NFT-платформа, бейджи, транзакции без газа и инфраструктура на периферии.",
  "hero.explore": "Смотреть NFT",
  "hero.mint": "Создать NFT",
  "hero.dashboard": "Панель",
  "stats.maxSupply": "Макс. выпуск",
  "stats.network": "Сеть",
  "stats.stage": "Этап",
  "status.live": "Работает",
  "status.beta": "Бета",
  "status.comingSoon": "Скоро",
  "status.done": "Готово",
  "status.inProgress": "В работе",
  "products.eyebrow": "Продукты",
  "products.title": "Растущая экосистема.",
  "products.description":
    "Пять продуктов на общей инфраструктуре, созданных для совместной работы.",
  "product.nft.description":
    "10 000 уникальных объектов с этапами по списку доступа и публичного минта. Полная поддержка перечисления для панели управления.",
  "product.nft.cta": "Открыть коллекцию",
  "product.badge.description":
    "Непередаваемые бейджи достижений, билеты и уровни участия. Пакетный минт и раздачи.",
  "product.badge.cta": "Смотреть бейджи",
  "product.mega.description":
    "Три шаблонные мегаколлекции — UCINA, MCINA и CINA — с миллиардами копий и фиксированным обменом 1:1000:1 000 000.",
  "product.mega.cta": "Смотреть коллекции",
  "product.gasless.name": "Минт без газа",
  "product.gasless.description":
    "Бета-интеграция Coinbase Smart Wallet для входа по ключу доступа и спонсируемых транзакций минта.",
  "product.gasless.cta": "Попробовать без газа",
  "product.edge.description":
    "API проверки списков доступа и биллинга в глобальной периферийной сети Cloudflare.",
  "product.edge.cta": "Статус API",
  "infrastructure.eyebrow": "Инфраструктура",
  "infrastructure.title": "Масштабируемый стек тестовой сети.",
  "infrastructure.description":
    "Каждый уровень проверяется в Base Sepolia до запуска основной сети.",
  "tech.base.description":
    "L2 Ethereum от Coinbase, настроенный для контрактов и транзакций CinaChain.",
  "tech.ipfs.description":
    "Децентрализованные метаданные с резервированием через три шлюза.",
  "tech.wallet.title": "Умный кошелёк",
  "tech.wallet.description":
    "Ключи доступа, без seed-фраз и транзакции без газа.",
  "tech.cloudflare.description":
    "Pages + Workers на периферии для глобальной доставки.",
  "roadmap.eyebrow": "План развития",
  "roadmap.title": "Пошаговая разработка.",
  "roadmap.description":
    "Каждый этап проверяется в тестовой сети до начала следующего.",
  "roadmap.phase1.title": "Инфраструктура",
  "roadmap.phase1.item1": "Развёртывание Cloudflare Pages",
  "roadmap.phase1.item2": "Собственные шлюзы IPFS",
  "roadmap.phase1.item3": "Основа периферийных Worker",
  "roadmap.phase2.title": "NFT-платформа",
  "roadmap.phase2.item1": "Контракт ERC-721 развёрнут",
  "roadmap.phase2.item2": "Минт и списки доступа",
  "roadmap.phase2.item3": "Панель и обзор",
  "roadmap.phase3.title": "Управление и бейджи",
  "roadmap.phase3.item1": "Панель администратора",
  "roadmap.phase3.item2": "Система бейджей ERC-1155",
  "roadmap.phase3.item3": "Подключение умного кошелька",
  "roadmap.phase4.title": "Масштабирование",
  "roadmap.phase4.item1": "Усиление Paymaster для продакшена",
  "roadmap.phase4.item2": "Усиление фирменного RPC-прокси",
  "roadmap.phase4.item3": "Запуск основной сети",
  "roadmap.phase4.item4": "Интеграция маркетплейса",
  "team.eyebrow": "Команда",
  "team.title": "Создано cinagroup.",
  "team.description":
    "Команда, сосредоточенная на реальных продуктах в блокчейне.",
  "team.coreRole": "Основная команда",
  "team.brandRole": "Бренд и сообщество",
  "team.openSource": "Открытый код",
  "team.openSourceRole": "При поддержке сообщества",
  "cta.title": "Начните строить на CinaChain",
  "cta.description":
    "Создайте первый NFT, получайте бейджи и присоединяйтесь к экосистеме.",
  "cta.mint": "Создать первый NFT",
  "cta.discord": "Вступить в Discord",
  "cta.powered": "{network} · Работает на Cloudflare",
  "footer.description":
    "Полноценная Web3-экосистема в Base Sepolia: NFT, бейджи, мегаколлекции и периферийная инфраструктура.",
  "footer.products": "Продукты",
  "footer.resources": "Ресурсы",
  "footer.community": "Сообщество",
  "footer.exchange": "Обмен",
  "footer.mint": "Минт",
  "footer.dashboard": "Панель",
  "footer.apiStatus": "Статус API",
  "footer.builtOn": "На базе",
  "footer.poweredBy": "При поддержке",
  "footer.stage": "Тестовая сеть Base Sepolia · Бета",
}

const es: Dictionary = {
  "meta.title": "CinaChain — Beta en Base Sepolia Testnet",
  "meta.description":
    "CinaChain: plataforma NFT, sistema de insignias, megacolecciones e infraestructura perimetral en Base Sepolia Testnet.",
  "common.skipToContent": "Ir al contenido",
  "language.switch": "Cambiar idioma",
  "language.select": "Seleccionar idioma",
  "theme.toggle": "Cambiar tema",
  "theme.select": "Seleccionar tema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.system": "Sistema",
  "nav.primary": "Navegación principal",
  "nav.dapp": "DApp",
  "nav.docs": "Documentación",
  "nav.collections": "Colecciones",
  "nav.github": "GitHub",
  "nav.enterDapp": "Entrar en DApp",
  "aria.home": "Inicio de CinaChain",
  "aria.github": "CinaChain en GitHub",
  "aria.discord": "CinaChain en Discord",
  "hero.buildingOn": "Construido en {network}",
  "hero.description":
    "Un ecosistema Web3 integral que funciona en {network}: plataforma NFT, insignias, transacciones sin gas e infraestructura perimetral.",
  "hero.explore": "Explorar NFT",
  "hero.mint": "Acuñar NFT",
  "hero.dashboard": "Panel",
  "stats.maxSupply": "Suministro máximo",
  "stats.network": "Red",
  "stats.stage": "Etapa",
  "status.live": "Activo",
  "status.beta": "Beta",
  "status.comingSoon": "Próximamente",
  "status.done": "Completado",
  "status.inProgress": "En curso",
  "products.eyebrow": "Productos",
  "products.title": "Un ecosistema en crecimiento.",
  "products.description":
    "Cinco productos sobre infraestructura compartida, diseñados para colaborar.",
  "product.nft.description":
    "10.000 coleccionables únicos con fases de lista permitida y acuñación pública. Enumeración completa para el panel.",
  "product.nft.cta": "Ver colección",
  "product.badge.description":
    "Insignias de logros vinculadas al alma, entradas y niveles de membresía. Acuñación por lotes y airdrops.",
  "product.badge.cta": "Ver insignias",
  "product.mega.description":
    "Tres megacolecciones basadas en plantillas — UCINA, MCINA y CINA — con miles de millones de copias y cambio fijo 1:1000:1.000.000.",
  "product.mega.cta": "Ver colecciones",
  "product.gasless.name": "Acuñación sin gas",
  "product.gasless.description":
    "Integración beta de Coinbase Smart Wallet para acceso con passkey y transacciones de acuñación patrocinadas.",
  "product.gasless.cta": "Probar sin gas",
  "product.edge.description":
    "API de verificación de listas y facturación en la red perimetral global de Cloudflare.",
  "product.edge.cta": "Estado de API",
  "infrastructure.eyebrow": "Infraestructura",
  "infrastructure.title": "Una pila de testnet preparada para escalar.",
  "infrastructure.description":
    "Cada capa se valida en Base Sepolia antes del lanzamiento en mainnet.",
  "tech.base.description":
    "L2 de Ethereum de Coinbase configurada para contratos y transacciones de CinaChain.",
  "tech.ipfs.description":
    "Metadatos descentralizados con respaldo de tres puertas de enlace.",
  "tech.wallet.title": "Cartera inteligente",
  "tech.wallet.description":
    "Basada en passkeys, sin frases semilla y con transacciones sin gas.",
  "tech.cloudflare.description":
    "Pages + Workers en el borde para entrega global.",
  "roadmap.eyebrow": "Hoja de ruta",
  "roadmap.title": "Construcción incremental.",
  "roadmap.description":
    "Cada fase se valida en testnet antes de iniciar la siguiente.",
  "roadmap.phase1.title": "Infraestructura",
  "roadmap.phase1.item1": "Despliegue de Cloudflare Pages",
  "roadmap.phase1.item2": "Puertas de enlace IPFS propias",
  "roadmap.phase1.item3": "Base de Workers perimetrales",
  "roadmap.phase2.title": "Plataforma NFT",
  "roadmap.phase2.item1": "Contrato ERC-721 desplegado",
  "roadmap.phase2.item2": "Acuñación y lista permitida",
  "roadmap.phase2.item3": "Panel y exploración",
  "roadmap.phase3.title": "Administración e insignias",
  "roadmap.phase3.item1": "Panel de administración",
  "roadmap.phase3.item2": "Sistema de insignias ERC-1155",
  "roadmap.phase3.item3": "Incorporación con cartera inteligente",
  "roadmap.phase4.title": "Escalar y expandir",
  "roadmap.phase4.item1": "Refuerzo de Paymaster en producción",
  "roadmap.phase4.item2": "Refuerzo del proxy RPC de marca",
  "roadmap.phase4.item3": "Despliegue en mainnet",
  "roadmap.phase4.item4": "Integración con marketplace",
  "team.eyebrow": "Equipo",
  "team.title": "Construido por cinagroup.",
  "team.description":
    "Un equipo centrado en entregar productos reales en cadena.",
  "team.coreRole": "Equipo principal",
  "team.brandRole": "Marca y comunidad",
  "team.openSource": "Código abierto",
  "team.openSourceRole": "Impulsado por la comunidad",
  "cta.title": "Empieza a construir en CinaChain",
  "cta.description":
    "Acuña tu primer NFT, consigue insignias y únete al ecosistema.",
  "cta.mint": "Acuñar tu primer NFT",
  "cta.discord": "Unirse a Discord",
  "cta.powered": "{network} · Impulsado por Cloudflare",
  "footer.description":
    "Ecosistema Web3 integral en Base Sepolia Testnet: NFT, insignias, megacolecciones e infraestructura perimetral.",
  "footer.products": "Productos",
  "footer.resources": "Recursos",
  "footer.community": "Comunidad",
  "footer.exchange": "Intercambio",
  "footer.mint": "Acuñar",
  "footer.dashboard": "Panel",
  "footer.apiStatus": "Estado de API",
  "footer.builtOn": "Construido en",
  "footer.poweredBy": "Impulsado por",
  "footer.stage": "Base Sepolia Testnet · Beta",
}

const pt: Dictionary = {
  "meta.title": "CinaChain — Beta na Base Sepolia Testnet",
  "meta.description":
    "CinaChain — plataforma NFT, sistema de emblemas, megacoleções e infraestrutura de borda na Base Sepolia Testnet.",
  "common.skipToContent": "Ir para o conteúdo",
  "language.switch": "Alterar idioma",
  "language.select": "Selecionar idioma",
  "theme.toggle": "Alternar tema",
  "theme.select": "Selecionar tema",
  "theme.light": "Claro",
  "theme.dark": "Escuro",
  "theme.system": "Sistema",
  "nav.primary": "Navegação principal",
  "nav.dapp": "DApp",
  "nav.docs": "Documentação",
  "nav.collections": "Coleções",
  "nav.github": "GitHub",
  "nav.enterDapp": "Entrar no DApp",
  "aria.home": "Início da CinaChain",
  "aria.github": "CinaChain no GitHub",
  "aria.discord": "CinaChain no Discord",
  "hero.buildingOn": "Construído na {network}",
  "hero.description":
    "Um ecossistema Web3 completo em execução na {network}: plataforma NFT, emblemas, transações sem gas e infraestrutura de borda.",
  "hero.explore": "Explorar NFTs",
  "hero.mint": "Criar NFT",
  "hero.dashboard": "Painel",
  "stats.maxSupply": "Oferta máxima",
  "stats.network": "Rede",
  "stats.stage": "Estágio",
  "status.live": "Ativo",
  "status.beta": "Beta",
  "status.comingSoon": "Em breve",
  "status.done": "Concluído",
  "status.inProgress": "Em andamento",
  "products.eyebrow": "Produtos",
  "products.title": "Um ecossistema em crescimento.",
  "products.description":
    "Cinco produtos em infraestrutura compartilhada, feitos para trabalhar juntos.",
  "product.nft.description":
    "10.000 colecionáveis únicos com fases de lista permitida e criação pública. Enumeração completa para integração ao painel.",
  "product.nft.cta": "Ver coleção",
  "product.badge.description":
    "Emblemas de conquistas intransferíveis, ingressos e níveis de associação. Criação em lote e airdrops.",
  "product.badge.cta": "Ver emblemas",
  "product.mega.description":
    "Três megacoleções baseadas em modelos — UCINA, MCINA e CINA — com bilhões de cópias e câmbio fixo de 1:1000:1.000.000.",
  "product.mega.cta": "Ver coleções",
  "product.gasless.name": "Criação sem gas",
  "product.gasless.description":
    "Integração beta da Coinbase Smart Wallet para entrada com passkey e transações de criação patrocinadas.",
  "product.gasless.cta": "Testar sem gas",
  "product.edge.description":
    "APIs de verificação de listas e cobrança na rede global de borda da Cloudflare.",
  "product.edge.cta": "Status da API",
  "infrastructure.eyebrow": "Infraestrutura",
  "infrastructure.title": "Uma pilha de testnet pronta para escalar.",
  "infrastructure.description":
    "Cada camada é validada na Base Sepolia antes do lançamento na mainnet.",
  "tech.base.description":
    "L2 Ethereum da Coinbase configurada para contratos e transações da CinaChain.",
  "tech.ipfs.description":
    "Metadados descentralizados com fallback de três gateways.",
  "tech.wallet.title": "Carteira inteligente",
  "tech.wallet.description":
    "Baseada em passkeys, sem frases-semente e com transações sem gas.",
  "tech.cloudflare.description":
    "Pages + Workers na borda para entrega global.",
  "roadmap.eyebrow": "Roteiro",
  "roadmap.title": "Construção incremental.",
  "roadmap.description":
    "Cada fase é validada na testnet antes do início da próxima.",
  "roadmap.phase1.title": "Infraestrutura",
  "roadmap.phase1.item1": "Implantação do Cloudflare Pages",
  "roadmap.phase1.item2": "Gateways IPFS personalizados",
  "roadmap.phase1.item3": "Base de Workers de borda",
  "roadmap.phase2.title": "Plataforma NFT",
  "roadmap.phase2.item1": "Contrato ERC-721 implantado",
  "roadmap.phase2.item2": "Criação + lista permitida",
  "roadmap.phase2.item3": "Painel e exploração",
  "roadmap.phase3.title": "Administração e emblemas",
  "roadmap.phase3.item1": "Painel administrativo",
  "roadmap.phase3.item2": "Sistema de emblemas ERC-1155",
  "roadmap.phase3.item3": "Integração de carteira inteligente",
  "roadmap.phase4.title": "Escalar e expandir",
  "roadmap.phase4.item1": "Reforço do Paymaster em produção",
  "roadmap.phase4.item2": "Reforço do proxy RPC de marca",
  "roadmap.phase4.item3": "Implantação na mainnet",
  "roadmap.phase4.item4": "Integração com marketplace",
  "team.eyebrow": "Equipe",
  "team.title": "Construído pela cinagroup.",
  "team.description": "Uma equipe focada em entregar produtos reais on-chain.",
  "team.coreRole": "Equipe principal",
  "team.brandRole": "Marca e comunidade",
  "team.openSource": "Código aberto",
  "team.openSourceRole": "Impulsionado pela comunidade",
  "cta.title": "Comece a construir na CinaChain",
  "cta.description":
    "Crie seu primeiro NFT, ganhe emblemas e entre no ecossistema.",
  "cta.mint": "Criar seu primeiro NFT",
  "cta.discord": "Entrar no Discord",
  "cta.powered": "{network} · Desenvolvido com Cloudflare",
  "footer.description":
    "Ecossistema Web3 completo na Base Sepolia Testnet: NFT, emblemas, megacoleções e infraestrutura de borda.",
  "footer.products": "Produtos",
  "footer.resources": "Recursos",
  "footer.community": "Comunidade",
  "footer.exchange": "Câmbio",
  "footer.mint": "Criar",
  "footer.dashboard": "Painel",
  "footer.apiStatus": "Status da API",
  "footer.builtOn": "Construído na",
  "footer.poweredBy": "Desenvolvido com",
  "footer.stage": "Base Sepolia Testnet · Beta",
}

const fr: Dictionary = {
  "meta.title": "CinaChain — Bêta sur Base Sepolia Testnet",
  "meta.description":
    "CinaChain — plateforme NFT, système de badges, méga-collections et infrastructure edge sur Base Sepolia Testnet.",
  "common.skipToContent": "Aller au contenu",
  "language.switch": "Changer de langue",
  "language.select": "Choisir la langue",
  "theme.toggle": "Changer de thème",
  "theme.select": "Choisir le thème",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "theme.system": "Système",
  "nav.primary": "Navigation principale",
  "nav.dapp": "DApp",
  "nav.docs": "Documentation",
  "nav.collections": "Collections",
  "nav.github": "GitHub",
  "nav.enterDapp": "Ouvrir la DApp",
  "aria.home": "Accueil CinaChain",
  "aria.github": "CinaChain sur GitHub",
  "aria.discord": "CinaChain sur Discord",
  "hero.buildingOn": "Construit sur {network}",
  "hero.description":
    "Un écosystème Web3 complet actuellement sur {network} : plateforme NFT, badges, transactions sans gas et infrastructure edge.",
  "hero.explore": "Explorer les NFT",
  "hero.mint": "Créer un NFT",
  "hero.dashboard": "Tableau de bord",
  "stats.maxSupply": "Offre maximale",
  "stats.network": "Réseau",
  "stats.stage": "Étape",
  "status.live": "En ligne",
  "status.beta": "Bêta",
  "status.comingSoon": "Bientôt",
  "status.done": "Terminé",
  "status.inProgress": "En cours",
  "products.eyebrow": "Produits",
  "products.title": "Un écosystème en croissance.",
  "products.description":
    "Cinq produits sur une infrastructure partagée, conçus pour fonctionner ensemble.",
  "product.nft.description":
    "10 000 objets uniques avec phases de liste autorisée et de création publique. Énumération complète pour le tableau de bord.",
  "product.nft.cta": "Voir la collection",
  "product.badge.description":
    "Badges de réussite non transférables, billets et niveaux d'adhésion. Création par lots et airdrops.",
  "product.badge.cta": "Voir les badges",
  "product.mega.description":
    "Trois méga-collections basées sur des modèles — UCINA, MCINA et CINA — avec des milliards d'exemplaires et un échange fixe 1:1000:1 000 000.",
  "product.mega.cta": "Voir les collections",
  "product.gasless.name": "Création sans gas",
  "product.gasless.description":
    "Intégration bêta de Coinbase Smart Wallet pour l'accès par passkey et les créations sponsorisées.",
  "product.gasless.cta": "Essayer sans gas",
  "product.edge.description":
    "API de vérification des listes et de facturation sur le réseau edge mondial de Cloudflare.",
  "product.edge.cta": "État de l'API",
  "infrastructure.eyebrow": "Infrastructure",
  "infrastructure.title": "Une pile testnet prête à évoluer.",
  "infrastructure.description":
    "Chaque couche est validée sur Base Sepolia avant le lancement mainnet.",
  "tech.base.description":
    "L2 Ethereum de Coinbase configuré pour les contrats et transactions CinaChain.",
  "tech.ipfs.description":
    "Métadonnées décentralisées avec repli sur trois passerelles.",
  "tech.wallet.title": "Portefeuille intelligent",
  "tech.wallet.description":
    "Basé sur les passkeys, sans phrase secrète et avec transactions sans gas.",
  "tech.cloudflare.description":
    "Pages + Workers déployés en edge pour une diffusion mondiale.",
  "roadmap.eyebrow": "Feuille de route",
  "roadmap.title": "Construction progressive.",
  "roadmap.description":
    "Chaque phase est validée sur testnet avant de passer à la suivante.",
  "roadmap.phase1.title": "Infrastructure",
  "roadmap.phase1.item1": "Déploiement Cloudflare Pages",
  "roadmap.phase1.item2": "Passerelles IPFS personnalisées",
  "roadmap.phase1.item3": "Base des Workers edge",
  "roadmap.phase2.title": "Plateforme NFT",
  "roadmap.phase2.item1": "Contrat ERC-721 déployé",
  "roadmap.phase2.item2": "Création + liste autorisée",
  "roadmap.phase2.item3": "Tableau de bord et exploration",
  "roadmap.phase3.title": "Administration et badges",
  "roadmap.phase3.item1": "Panneau d'administration",
  "roadmap.phase3.item2": "Système de badges ERC-1155",
  "roadmap.phase3.item3": "Intégration du portefeuille intelligent",
  "roadmap.phase4.title": "Évoluer et s'étendre",
  "roadmap.phase4.item1": "Renforcement du Paymaster en production",
  "roadmap.phase4.item2": "Renforcement du proxy RPC de marque",
  "roadmap.phase4.item3": "Déploiement mainnet",
  "roadmap.phase4.item4": "Intégration marketplace",
  "team.eyebrow": "Équipe",
  "team.title": "Construit par cinagroup.",
  "team.description":
    "Une équipe concentrée sur la livraison de vrais produits on-chain.",
  "team.coreRole": "Équipe principale",
  "team.brandRole": "Marque et communauté",
  "team.openSource": "Open source",
  "team.openSourceRole": "Propulsé par la communauté",
  "cta.title": "Commencez à construire sur CinaChain",
  "cta.description":
    "Créez votre premier NFT, gagnez des badges et rejoignez l'écosystème.",
  "cta.mint": "Créer votre premier NFT",
  "cta.discord": "Rejoindre Discord",
  "cta.powered": "{network} · Propulsé par Cloudflare",
  "footer.description":
    "Écosystème Web3 complet sur Base Sepolia Testnet : NFT, badges, méga-collections et infrastructure edge.",
  "footer.products": "Produits",
  "footer.resources": "Ressources",
  "footer.community": "Communauté",
  "footer.exchange": "Échange",
  "footer.mint": "Créer",
  "footer.dashboard": "Tableau de bord",
  "footer.apiStatus": "État de l'API",
  "footer.builtOn": "Construit sur",
  "footer.poweredBy": "Propulsé par",
  "footer.stage": "Base Sepolia Testnet · Bêta",
}

const dictionaries: Record<Locale, Dictionary> = {
  zh,
  en,
  ja,
  ko,
  ru,
  es,
  pt,
  fr,
}

const STORAGE_KEY = "cinachain.locale"

function resolveLocale(language?: string | null): Locale {
  const normalized = language?.trim().toLowerCase().replace("_", "-") ?? ""
  const base = normalized.split("-")[0]
  return SUPPORTED_LOCALES.includes(base as Locale) ? (base as Locale) : "en"
}

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }

  return typeof navigator === "undefined"
    ? "en"
    : resolveLocale(navigator.languages?.[0] ?? navigator.language)
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    const dictionary = dictionaries[locale]
    document.documentElement.lang = HTML_LANG_BY_LOCALE[locale]
    document.title = dictionary["meta.title"]
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", dictionary["meta.description"])
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Keep the in-memory locale when persistence is unavailable.
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      interpolate(dictionaries[locale][key] ?? en[key], params),
    [locale]
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within I18nProvider")
  return context
}
