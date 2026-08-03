/**
 * 部署 CinaChain 合约到 Base Sepolia / Base Mainnet
 * 使用 viem — 纯 Node.js，无需 Foundry
 *
 * 用法:
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy.mjs
 *
 * 可选环境变量:
 *   DEPLOY_RPC_URL=https://sepolia.base.org (默认 Base Sepolia)
 *   DEPLOY_NETWORK=base-sepolia | base-mainnet
 */
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem"
import { base, baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, "../contracts/out")

// ─── Config ───
const PRIVATE_KEY = process.env.DEPLOY_PRIVATE_KEY
const NETWORK = process.env.DEPLOY_NETWORK || "base-sepolia"
const RPC_URL = process.env.DEPLOY_RPC_URL || (NETWORK === "base-mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org")

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
  console.error("❌ Set DEPLOY_PRIVATE_KEY (0x... format)")
  process.exit(1)
}

const chain = NETWORK === "base-mainnet" ? base : baseSepolia
const account = privateKeyToAccount(PRIVATE_KEY)

// ─── Clients ───
const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) })
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) })

// ─── Load artifacts ───
function loadArtifact(name) {
  return JSON.parse(readFileSync(resolve(OUT, `${name}.json`), "utf8"))
}

// ─── Deploy helper ───
async function deploy(name, abi, bytecode, args) {
  console.log(`\n📦 Deploying ${name}...`)
  console.log(`   Args: ${JSON.stringify(args).slice(0, 100)}`)

  const hash = await walletClient.deployContract({ abi, bytecode, args, chain })

  console.log(`   TX: ${chain.blockExplorers?.default?.url}/tx/${hash}`)
  console.log(`   ⏳ Waiting for confirmation...`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  if (receipt.status === "reverted") {
    console.error(`   ❌ Transaction reverted!`)
    process.exit(1)
  }

  console.log(`   ✅ Deployed at: ${receipt.contractAddress}`)
  console.log(`   Gas used: ${Number(receipt.gasUsed).toLocaleString()}`)
  console.log(`   Block: ${receipt.blockNumber}`)

  return receipt.contractAddress
}

// ─── Check balance ───
async function main() {
  console.log("═══════════════════════════════════════════════")
  console.log("  CinaChain Contract Deployment")
  console.log("═══════════════════════════════════════════════")
  console.log(`  Network:  ${NETWORK} (chainId ${chain.id})`)
  console.log(`  RPC:      ${RPC_URL}`)
  console.log(`  Deployer: ${account.address}`)
  console.log("═══════════════════════════════════════════════")

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`\n💰 Balance: ${formatEther(balance)} ETH`)

  if (balance === 0n) {
    console.error("❌ No ETH balance! Get test ETH from a Base Sepolia faucet:")
    console.error("   https://faucet.quicknode.com/base/sepolia")
    process.exit(1)
  }

  // ─── Deploy CinaNFT ───
  const nftArt = loadArtifact("CinaNFT")
  const nftAddress = await deploy(
    "CinaNFT",
    nftArt.abi,
    nftArt.bytecode,
    [
      "CinaChain NFT",         // name
      "CINA",                  // symbol
      10000n,                  // maxSupply
      parseEther("0.001"),     // mintPrice (0.001 ETH)
      account.address,         // owner
    ]
  )

  // ─── Deploy CinaBadge ───
  const badgeArt = loadArtifact("CinaBadge")
  const badgeAddress = await deploy(
    "CinaBadge",
    badgeArt.abi,
    badgeArt.bytecode,
    [
      "ipfs://QmBadges/{id}.json", // metadata URI (update later via setURI)
      account.address,             // owner
    ]
  )

  // ─── Summary ───
  console.log("\n═══════════════════════════════════════════════")
  console.log("  ✅ Deployment Complete!")
  console.log("═══════════════════════════════════════════════")
  console.log(`\n📋 CinaNFT:    ${nftAddress}`)
  console.log(`   Explorer:   ${chain.blockExplorers?.default?.url}/address/${nftAddress}`)
  console.log(`\n📋 CinaBadge:  ${badgeAddress}`)
  console.log(`   Explorer:   ${chain.blockExplorers?.default?.url}/address/${badgeAddress}`)

  console.log("\n📝 Add to .env.local:")
  console.log(`NEXT_PUBLIC_CINA_NFT_CONTRACT=${nftAddress}`)
  console.log(`NEXT_PUBLIC_CINA_ERC1155_CONTRACT=${badgeAddress}`)

  console.log("\n🔄 Rebuild DApp:")
  console.log("npm run build")
  console.log('CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy out --project-name=cinachain-nft-dapp --commit-dirty=true')
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message?.split("\n")[0] || err)
  process.exit(1)
})
