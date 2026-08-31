import { adminEn } from "./admin"
import { integrationEn } from "./integration"

// English dictionary — the source of truth. All keys must exist here.
// Sentence-case per the design system; period-terminate sentence-style headlines.
export const en: Record<string, string> = {
  ...adminEn,
  ...integrationEn,
  // ── Header nav ──
  "nav.explore": "Explore",
  "nav.mint": "Mint",
  "nav.mintBatch": "Batch mint",
  "nav.collections": "Collections",
  "nav.exchange": "Exchange",
  "nav.dashboard": "Dashboard",
  "nav.integration": "Integration",
  "nav.documentation": "Documentation",
  "nav.primary": "Primary navigation",
  "nav.openMenu": "Open navigation menu",
  "nav.menuTitle": "Navigation menu",
  "nav.homeAria": "CinaChain home",
  "nav.skipToContent": "Skip to content",
  "nav.connectWallet": "Connect wallet",
  "nav.signOut": "Sign out",

  // ── Identity hub ──
  "identity.title": "Identity",
  "identity.description":
    "Manage your CinaSeek account and onchain wallet in one place.",
  "identity.accountTitle": "CinaSeek account",
  "identity.accountDescription":
    "Verify with CinaSeek Accounts. New users are created automatically.",
  "identity.walletTitle": "Onchain wallet",
  "identity.walletDescription":
    "Connect a wallet for minting, exchange, and other onchain actions.",
  "identity.signedIn": "Signed in",
  "identity.signedOut": "Signed out",
  "identity.continueWithCinaSeek": "Continue with CinaSeek",
  "identity.returnToCinaSeek": "Return to CinaSeek",
  "identity.signOutAccount": "Sign out of account",
  "identity.signInUnavailable": "Sign-in unavailable",
  "identity.manageWallet": "Manage wallet",
  "identity.independentNote":
    "Account sign-in and wallet connection stay separate, so you always control which identity each action uses.",
  "identity.statusLabel": "Account: {account}. Wallet: {wallet}.",

  // ── Dashboard sidebar ──
  "sidebar.backToSite": "Back to site",
  "sidebar.user": "User",
  "sidebar.admin": "Admin",
  "sidebar.overview": "Overview",
  "sidebar.myNfts": "My NFTs",
  "sidebar.badges": "Badges",
  "sidebar.favorites": "Favorites",
  "sidebar.account": "Account",
  "sidebar.credits": "Credits",
  "sidebar.keyIngress": "Key ingress",
  "sidebar.whitelist": "Whitelist",
  "sidebar.statistics": "Statistics",
  "sidebar.contract": "Contract",
  "sidebar.billing": "Billing",

  // ── Common actions ──
  "action.connectWallet": "Connect wallet",
  "action.signOut": "Sign out",
  "action.viewAll": "View all",
  "action.mint": "Mint",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.close": "Close",
  "action.save": "Save",
  "action.loading": "Loading...",
  "action.retry": "Retry",

  // ── Common status ──
  "status.connected": "Connected",
  "status.disconnected": "Not connected",
  "status.wrongNetwork": "Wrong network",
  "status.paused": "Paused",
  "status.active": "Active",
  "status.inProgress": "In progress",
  "status.completed": "Completed",
  "status.failed": "Failed",
  "status.success": "Success",
  "status.unavailable": "Unavailable",
  "status.live": "Live",
  "status.beta": "Beta",
  "status.comingSoon": "Coming soon",
  "status.done": "Done",

  // ── Home page ──
  "home.heroTitle": "Own the chain.",
  "home.buildingOn": "Building on {network}",
  "home.heroDescription":
    "A full-stack Web3 ecosystem currently running on {network} — NFT platform, badge system, gasless transactions, and edge-deployed infrastructure.",
  "home.getStarted": "Get started",
  "home.exploreCollection": "Explore collection",
  "home.exploreNfts": "Explore NFTs",
  "home.mintNft": "Mint NFT",
  "home.statsTitle": "By the numbers.",
  "home.statsTotalMinted": "Total minted",
  "home.statsMaxSupply": "Max supply",
  "home.statsMintPrice": "Mint price",
  "home.statsNetwork": "Network",
  "home.statsLastKnown": "Collection statistics, last known values",
  "home.productsEyebrow": "Products",
  "home.productsTitle": "A growing ecosystem.",
  "home.productsDescription":
    "Five products built on shared infrastructure, designed to work together.",
  "home.productNftDescription":
    "10,000 unique collectibles with whitelist and public mint phases. Full enumerable support for dashboard integration.",
  "home.viewCollection": "View collection",
  "home.productBadgeDescription":
    "Soulbound achievement badges, event tickets, and membership tiers. Batch minting and airdrop support.",
  "home.viewBadges": "View badges",
  "home.productMegaDescription":
    "Three template-based mega-collections — UCINA, MCINA, CINA — with billions of copies each and a fixed 1:1000:1,000,000 exchange.",
  "home.viewCollections": "View collections",
  "home.gaslessMinting": "Gasless minting",
  "home.productGaslessDescription":
    "Coinbase Smart Wallet integration with passkey-based onboarding. Users mint without holding ETH.",
  "home.tryGasless": "Try gasless",
  "home.edgeApi": "Edge API",
  "home.productApiDescription":
    "Whitelist verification and paymaster proxy running on Cloudflare's global edge network.",
  "home.apiStatus": "API status",
  "home.infrastructureEyebrow": "Infrastructure",
  "home.infrastructureTitle": "A testnet stack built to scale.",
  "home.infrastructureDescription":
    "Every layer is being validated on Base Sepolia before the mainnet launch.",
  "home.baseDescription":
    "Coinbase's Ethereum L2 configured for CinaChain contracts and transactions.",
  "home.ipfsDescription":
    "Decentralized metadata with three-gateway fallback for reliability.",
  "home.smartWallet": "Smart wallet",
  "home.smartWalletDescription":
    "Passkey-based wallets. No seed phrases. Gasless transactions.",
  "home.cloudflareDescription":
    "Edge-deployed Pages and Workers. Sub-50ms global latency.",
  "home.roadmapEyebrow": "Roadmap",
  "home.roadmapTitle": "Built incrementally.",
  "home.roadmapDescription":
    "Each phase is validated on testnet before the next begins.",
  "home.roadmapInfrastructure": "Infrastructure",
  "home.roadmapCloudflareDeploy": "Cloudflare Pages deploy",
  "home.roadmapIpfsGateways": "Custom IPFS gateways",
  "home.roadmapRpcProxy": "RPC proxy worker",
  "home.roadmapNftPlatform": "NFT platform",
  "home.roadmapErc721": "ERC-721 contract deployed",
  "home.roadmapMintWhitelist": "Mint and whitelist system",
  "home.roadmapDashboardExplore": "Dashboard and explore",
  "home.roadmapAdminBadges": "Admin and badges",
  "home.roadmapAdminPanel": "Admin control panel",
  "home.roadmapBadgeSystem": "ERC-1155 badge system",
  "home.roadmapGasless": "Gasless minting (CDP)",
  "home.roadmapScale": "Scale and expand",
  "home.roadmapUsdc": "USDC paymaster integration",
  "home.roadmapMainnet": "Mainnet deployment",
  "home.roadmapMarketplace": "Marketplace integration",
  "home.teamEyebrow": "Team",
  "home.teamTitle": "Built by cinagroup.",
  "home.teamDescription": "A team focused on shipping real products on-chain.",
  "home.coreTeam": "Core team",
  "home.brandCommunity": "Brand and community",
  "home.openSource": "Open source",
  "home.poweredByCommunity": "Powered by the community",
  "home.ctaTitle": "Start building on CinaChain",
  "home.ctaDescription":
    "Mint your first NFT, earn badges, and join the ecosystem.",
  "home.mintFirstNft": "Mint your first NFT",
  "home.joinDiscord": "Join Discord",
  "home.poweredBy": "{network} · Powered by Cloudflare",

  // ── Footer ──
  "footer.builtBy": "Built by cinagroup",
  "footer.product": "Product",
  "footer.resources": "Resources",
  "footer.company": "Company",
  "footer.integrations": "Integrations",
  "footer.community": "Community",
  "footer.apiKeys": "API keys",
  "footer.signInWithEthereum": "Sign-In With Ethereum",
  "footer.tagline":
    "NFT platform on {network} ({stage}) with Cloudflare Web3 infrastructure.",
  "footer.githubAria": "CinaChain on GitHub",
  "footer.xAria": "CinaChain on X",
  "footer.discordAria": "CinaChain on Discord",
  "footer.allRightsReserved": "All rights reserved.",

  // ── Credits page ──
  "credits.title": "Credits",
  "credits.description":
    "CinaCredit is the settlement token for the cina economy — it caps your API billing usage and settles marketplace earnings.",
  "credits.yourBalance": "Your balance",
  "credits.totalSupply": "Total supply",
  "credits.howItWorks": "How credits work",
  "credits.issuedByTeam": "CinaCredit is issued by the CinaChain team",
  "credits.opsIssued": "Credits are ops-issued.",
  "credits.oneTokenTwoRoles": "One token, two roles.",
  "credits.keepAnEyeOnUsage": "Keep an eye on usage.",
  "credits.billingLedger": "Billing ledger",
  "credits.onChainBalance": "On-chain balance",
  "credits.committedUsage": "Committed usage",
  "credits.usable": "Usable",
  "credits.cumulativeSpend": "Cumulative spend",

  // ── Keys page ──
  "keys.title": "Key ingress",
  "keys.description":
    "Register and manage API keys for the CinaChain billing system.",

  // ── Admin overview ──
  "admin.title": "Administration",
  "admin.overview": "Overview",
  "admin.mintedCount": "Minted",
  "admin.maxCount": "Max supply",
  "admin.mintPrice": "Mint price",
  "admin.paused": "Paused",
  "admin.active": "Active",

  // ── Dashboard overview ──
  "dashboard.welcomeBack": "Welcome back,",
  "dashboard.ethBalance": "ETH balance",
  "dashboard.nftsOwned": "NFTs owned",
  "dashboard.cinaChainNfts": "CinaChain NFTs",
  "dashboard.collectionProgress": "Collection progress",
  "dashboard.totalMinted": "Total minted",
  "dashboard.membershipTier": "Membership tier",
  "dashboard.creditSpent": "credit spent",
  "dashboard.topTierReached": "Top tier reached",

  // ── Language switcher ──
  "language.switch": "Switch language",
  "language.select": "Select language",
  "theme.toggle": "Toggle theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",

  // ── Explore page ──
  "explore.title": "Explore",
  "explore.collectionUnavailable": "Collection data unavailable",
  "explore.showingLastKnown": "Showing last known data",

  // ── Mint page ──
  "mint.title": "Mint",
  "mint.connectWallet": "Connect wallet",
  "mint.mintItems": "Mint items",

  // ── Exchange page ──
  "exchange.title": "Exchange",
  "exchange.swapDirection": "Swap direction",

  // ── My NFTs page ──
  "nfts.yourNfts": "Your NFTs",
  "nfts.connectWallet": "Connect your wallet",
  "nfts.collectionSummary": "Collection summary",

  // ── Badges page ──
  "badges.title": "Badges",
  "badges.noBadges": "No badges yet",

  // ── Favorites page ──
  "favorites.title": "Favorites",
  "favorites.noFavorites": "No favorites yet",

  // ── Account page ──
  "account.title": "Account",
  "account.quickLinks": "Quick links",

  // ── Settings page ──
  "settings.title": "Settings",
  "settings.apiKeys": "API keys",

  // ── Admin pages ──
  "admin.quickActions": "Quick actions",
  "admin.mintBadges": "Mint badges",
  "admin.manageWhitelist": "Manage whitelist",
  "admin.viewStats": "View statistics",
  "admin.contractSettings": "Contract settings",
  "admin.billingSettings": "Billing settings",
  "admin.badgeTypes": "Badge types",
  "admin.howItWorks": "How it works",
  "admin.mintingProgress": "Minting progress",
  "admin.contractInfo": "Contract information",

  // ── Badges page ──
  "badges.connectWallet": "Connect your wallet",
  "badges.connectToView":
    "Connect your wallet to view your CinaChain badges and achievements.",
  "badges.yourBadges": "Your badges",

  // ── Admin billing ──
  "admin.billingManagement": "Billing management",
  "admin.issueCredit": "Issue credit",
  "admin.recipientAddress": "Recipient address",
  "admin.emergencyControls": "Emergency controls",
  "admin.creditOperations": "Credit operations",

  // ── Shared page copy ──
  "common.viewOn": "View on {explorer}",
  "common.gasless": "Gasless",
  "auth.required": "Authentication required",
  "auth.connectWalletTitle": "Connect your wallet",
  "tier.free": "Free",
  "tier.bronze": "Bronze",
  "tier.silver": "Silver",
  "tier.gold": "Gold",
  "tier.diamond": "Diamond",
  "tier.whale": "Whale",

  // ── Admin access ──
  "admin.loadingStatus": "Loading admin status...",
  "admin.accessRequired": "Admin access required",
  "admin.connectToAccess": "Connect your wallet to access the admin panel.",
  "admin.accessDenied": "Access denied",
  "admin.notAuthorized":
    "Your wallet address is not authorized to access the admin panel.",
  "admin.returnHome": "Return to home",

  // ── Dashboard details ──
  "dashboard.tierUnavailable": "Tier data unavailable",
  "dashboard.creditSpentValue": "{value} credit spent",
  "dashboard.creditToTier": "{value} credit to {tier}",
  "dashboard.badgePending": "Badge pending: {badges}",
  "dashboard.eligible": "Eligible",
  "dashboard.public": "Public",
  "dashboard.notListed": "Not listed",
  "dashboard.checkBackLater": "Check back later",
  "dashboard.lastCompleteResponse": "Last complete on-chain response",
  "dashboard.progressStaleDescription":
    "The latest refresh failed. Collection progress uses the last complete on-chain response.",
  "dashboard.progressUnavailableDescription":
    "Collection progress is unavailable because the contract reads did not return a complete response.",
  "dashboard.showingLastProgress": "Showing last known collection progress",
  "dashboard.progressUnavailable": "Collection progress unavailable",
  "dashboard.quickActions": "Quick actions",
  "dashboard.viewMyNfts": "View my NFTs",
  "dashboard.connectDescription":
    "Connect your wallet to view your personalized dashboard, manage your NFTs, and access exclusive features.",

  // ── Explore details ──
  "explore.eyebrow": "Collection",
  "explore.heading": "CinaChain NFT gallery",
  "explore.description":
    "Browse the full collection. Each NFT is stored on IPFS with multi-gateway fallback.",
  "explore.contractNotConfigured":
    "NFT contract not configured. Set NEXT_PUBLIC_CINA_NFT_CONTRACT to view the collection.",
  "explore.readErrorDescription":
    "We could not read the collection from Base Sepolia. No NFT count or empty state is being inferred.",
  "explore.staleDescription":
    "The latest refresh failed. The gallery below uses the last complete on-chain response.",
  "explore.emptyTitle": "No NFTs minted yet.",
  "explore.emptyDescription": "Be the first to mint a CinaChain NFT!",
  "explore.showingFirst": "Showing first 100 of {count} minted NFTs.",

  // ── Mint details ──
  "mint.heading": "Mint CinaChain NFT",
  "mint.connectDescription": "Connect your wallet to mint.",
  "mint.checkingStatus": "Checking mint status...",
  "mint.limitReachedDescription":
    "You have reached your mint limit for this address.",
  "mint.quantityRange": "Quantity must be between 1 and {max}.",
  "mint.noWhitelistProof":
    "No whitelist proof is available for this address. Please contact the CinaChain team.",
  "mint.confirmInWallet": "Confirm in wallet...",
  "mint.confirming": "Confirming...",
  "mint.minting": "Minting...",
  "mint.buttonLabel": "Mint {quantity} NFT",
  "mint.whitelistDescription": "Exclusive whitelist minting is now active.",
  "mint.publicDescription": "Public minting is now open to everyone.",
  "mint.inactiveDescription": "Minting is not currently active.",
  "mint.batchPrompt": "Looking to mint badges in bulk?",
  "mint.batchLink": "Batch mint ERC-1155",
  "mint.whitelistServiceUnavailable":
    "The whitelist service is temporarily unavailable. Public mint status is shown; whitelist minting may be affected.",
  "mint.notWhitelisted":
    "This address is not on the whitelist. Public minting is still open at the regular price.",
  "mint.details": "Mint details",
  "mint.whitelistActive": "Whitelist mint active",
  "mint.publicActive": "Public mint active",
  "mint.notActive": "Mint not active",
  "mint.whitelistEligible":
    "You are on the whitelist and can mint up to {limit} NFTs.",
  "mint.publicPrice": "Public mint active. Price: {price} ETH per NFT.",
  "mint.inactiveAlert":
    "Minting is not currently active. Please check back later.",
  "mint.success": "Mint successful!",
  "mint.quantity": "Quantity",
  "mint.pricePerNft": "Price per NFT",
  "mint.total": "Total",
  "mint.mintedByYou": "Minted by you",
  "mint.whitelistMintsByYou": "Whitelist mints by you",
  "mint.limitReached": "Mint limit reached",

  // ── Exchange details ──
  "exchange.contractNotConfigured":
    "CinaMega contract not configured. Set NEXT_PUBLIC_CINA_MEGA_CONTRACT.",
  "exchange.heading": "Exchange CinaMega",
  "exchange.description":
    "Convert between UCINA, MCINA, and CINA at the fixed rate. Exchanges are atomic: source tokens are burned and destination tokens are minted in one transaction.",
  "exchange.fixedRate": "Fixed rate",
  "exchange.success": "Exchange complete!",
  "exchange.youHold": "You hold: UCINA {ucina} · MCINA {mcina} · CINA {cina}",
  "exchange.connectWallet": "Connect a wallet to exchange.",
  "exchange.youGive": "You give (source)",
  "exchange.amount": "Amount",
  "exchange.amountAria": "Amount of {token} to exchange",
  "exchange.insufficientBalance":
    "Insufficient balance — you hold {amount} {token}.",
  "exchange.youReceiveDestination": "You receive (destination)",
  "exchange.youReceive": "You receive",
  "exchange.dustBurned": "Dust burned: {amount} units (floor conversion)",
  "exchange.amountTooSmall":
    "Amount too small — minimum for 1 {destination}: {amount} {source}.",
  "exchange.exchanging": "Exchanging...",

  // ── Dashboard subpages ──
  "nfts.description": "Your CinaChain NFT collection.",
  "nfts.totalOwned": "Total NFTs owned",
  "nfts.readErrorDescription":
    "We could not read this wallet's NFT balance or ownership data. An empty collection is not being inferred.",
  "nfts.readErrorTitle": "NFT ownership data unavailable",
  "nfts.staleDescription":
    "The latest refresh failed. The balance and NFTs below are from the last complete on-chain response.",
  "nfts.staleTitle": "Showing last known ownership data",
  "nfts.loadMore": "Load more ({count} more)",
  "nfts.showingOwned": "Showing {shown} of {count} owned NFTs.",
  "nfts.emptyDescription": "You don't own any CinaChain NFTs yet.",
  "nfts.mintFirst": "Mint your first NFT",
  "nfts.connectDescription": "Connect your wallet to view your NFT collection.",
  "favorites.description": "NFTs you've saved for later.",
  "favorites.clearAll": "Clear all",
  "favorites.emptyDescription":
    "Start exploring and select the heart icon to save NFTs you like.",
  "badges.description": "Collect achievements and unlock special privileges.",
  "badges.contractNotConfigured": "Badge contract not configured.",
  "badges.configureContract":
    "Set NEXT_PUBLIC_CINA_ERC1155_CONTRACT to enable badges.",
  "badges.earned": "Earned",
  "badges.earnedSummary":
    "You've earned {count} badge(s). Keep minting and collecting to unlock more!",
  "badges.owned": "Owned",
  "badges.loading": "Loading badges...",
  "badges.emptyDescription":
    "Mint NFTs and participate in the community to earn badges!",

  // ── Account details ──
  "account.description": "Manage your wallet and authentication settings.",
  "account.walletDetails": "Your connected wallet details",
  "account.address": "Address",
  "account.ensName": "ENS name",
  "account.ensResolved": "(resolved)",
  "account.noEns": "(no ENS)",
  "account.network": "Network",
  "account.balance": "Balance",
  "account.unsupportedNetwork": "{network} (unsupported)",
  "account.unknownNetwork": "Unknown",
  "account.authentication": "Authentication",
  "account.cinaSeekSso": "CinaSeek Accounts single sign-on",
  "account.cinaSeekStatus": "CinaSeek account status",
  "account.authenticated": "Authenticated",
  "account.sessionExpires": "Session expires:",
  "account.cinaSeekDescription":
    "Continue to CinaSeek Accounts to verify by email, wallet, Google, or GitHub. New users are created after verification. Your onchain wallet remains separate.",
  "account.openingCinaSeek": "Opening CinaSeek...",
  "account.quickLinksDescription": "Useful resources for your wallet",
  "account.mintPage": "Mint page",
  "account.connectDescription":
    "Connect your wallet to view account details, manage settings, and access exclusive features.",

  // ── Key ingress details ──
  "keys.connectWalletFirst": "Connect your wallet first.",
  "keys.tooShort": "API key is too short.",
  "keys.registered": "Ingress registered: {id} ({status})",
  "keys.submitFailed": "Failed to submit key.",
  "keys.ingressDescription":
    "Share an API key with the platform pool and earn CinaCredit after it is consumed.",
  "keys.submitTitle": "Submit API key",
  "keys.submitDescription":
    "Your key is encrypted at rest and never exposed; you earn credits when the pool consumes it.",
  "keys.model": "Model",
  "keys.declaredAmount": "Declared amount (micro-credit)",
  "keys.submitAction": "Submit key",
  "keys.recordsTitle": "Your ingress records",
  "keys.recordsDescription": "Pending / minting / minted status",
  "keys.noRecords":
    "No records yet. Submit a key above; the status updates after the pool consumes it.",
  "keys.recordProgress":
    "{model} · confirmed {confirmed} / {declared} micro-credits",

  // ── Credit details ──
  "credits.contractNotConfigured":
    "The credit contract is not configured. Please contact the CinaChain team.",
  "credits.connectIntro":
    "CinaCredit powers API billing and settles marketplace earnings. Connect your wallet to view your balance.",
  "credits.connectDescription":
    "Connect your wallet to view your credit balance and usage.",
  "credits.pausedDescription":
    "Credit operations are paused; transfers, mints, and burns are frozen. Please check back later.",
  "credits.balanceDescription":
    "On-chain CinaCredit (CINA-C) held by your wallet",
  "credits.creditUnit": "credit",
  "credits.viewContract": "View contract on the explorer",
  "credits.opsIssuedDescription":
    "Top-ups are granted by the team to your wallet address. Contact the CinaChain team to add API credits.",
  "credits.twoRolesDescription":
    "Your balance caps API billing and is also the token used to settle marketplace earnings on-chain.",
  "credits.usageDescription":
    "API calls reduce your available credit. The ledger shows how much of your on-chain balance remains usable.",
  "credits.ledgerDescription":
    "Server-side metering for your address (billing worker)",
  "credits.ledgerUnavailable":
    "The ledger is unavailable because the billing service could not be reached.",

  // ── NFT detail ──
  "nftDetail.notMintedTitle": "This NFT has not been minted yet",
  "nftDetail.notMintedDescription":
    "Token #{tokenId} does not exist on-chain yet. Be the first to mint it and own it forever.",
  "nftDetail.mintToken": "Mint NFT #{tokenId}",
  "nftDetail.tokenId": "Token ID",
  "nftDetail.owner": "Owner",
  "nftDetail.you": "You",
  "nftDetail.description": "Description",
  "nftDetail.attributes": "Attributes",
  "nftDetail.traits": "{count} traits",
  "nftDetail.contractDetails": "Contract details",
  "nftDetail.contractAddress": "Contract address",
  "nftDetail.tokenStandard": "Token standard",
  "nftDetail.blockchain": "Blockchain",

  // ── Batch mint ──
  "batchMint.heading": "Batch mint ERC-1155",
  "batchMint.connectDescription": "Connect your wallet to batch mint.",
  "batchMint.contractNotConfigured": "ERC-1155 contract address not configured.",
  "batchMint.addOneItem": "Add at least one item.",
  "batchMint.invalidTokenId": "Token ID “{id}” is invalid.",
  "batchMint.invalidAmount": "Amount “{amount}” must be a positive integer.",
  "batchMint.failed": "Failed to mint batch.",
  "batchMint.description":
    "Mint multiple badge types to your address in one transaction. Ideal for collections with multiple variants.",
  "batchMint.note": "Note:",
  "batchMint.ownerOnlyPrefix": "the underlying contract function is",
  "batchMint.ownerOnlySuffix":
    "only the contract owner's wallet can execute this.",
  "batchMint.success": "Batch mint confirmed!",
  "batchMint.waitingConfirmation":
    "Transaction submitted. Waiting for confirmation...",
  "batchMint.reverted": "Transaction reverted on-chain.",
  "batchMint.itemsDescription":
    "Add multiple token IDs and amounts to mint in one transaction.",
  "batchMint.removeItem": "Remove item",
  "batchMint.addItem": "Add item",
  "batchMint.totalItems": "Total items",
  "batchMint.totalAmount": "Total amount",
  "batchMint.buttonLabel": "Batch mint {count} item(s)",

  // ── Mega collections ──
  "collections.freePublicMint": "Free public mint",
  "collections.exchangeOnly": "Exchange only",
  "collections.description":
    "Three template-based mega-collections with billions of copies each, linked by a fixed exchange rate.",
  "collections.fixedRate": "Fixed exchange rate",
  "collections.templatesLocked": "Templates locked — immutable",
  "collections.templatesPending": "Templates pending initialization",
  "collections.minted": "Minted!",
  "collections.smartAccountNotice":
    "Smart account notice: your embedded wallet is not deployed on-chain until its first transaction. Do not send NFTs or funds to it from another wallet; assets sent before deployment can be lost.",
  "collections.mintUcina": "Mint UCINA",
  "collections.freeMintDescription": "Free public mint of the base unit",
  "collections.perAddressCap": "up to {amount} per address",
  "collections.mintingPaused": "minting paused",
  "collections.decreaseAmount": "Decrease mint amount",
  "collections.increaseAmount": "Increase mint amount",
  "collections.mintAmount": "Mint {amount} UCINA",
  "collections.exchangePrompt":
    "Hold UCINA? Exchange it for MCINA and CINA on the",
  "collections.exchangePage": "exchange page",
  "collections.ucinaDescription":
    "The base unit. Free to mint with unlimited supply — the entry point to the Cina economy.",
  "collections.mcinaDescription":
    "The middle unit. 1 MCINA equals 1,000 UCINA and is obtained only by exchanging up.",
  "collections.cinaDescription":
    "The flagship unit. 1 CINA equals 1,000 MCINA or 1,000,000 UCINA. Exchange only.",
}
