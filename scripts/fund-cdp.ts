/**
 * Step 1: 用 CDP faucet 给用户地址注资
 * Step 2: 用 viem 直接部署合约
 *
 * 这样 CDP 只负责注资（不需要私钥），部署用 viem（需要私钥）
 * 或者：纯 CDP 注资 + 用户在 Remix/Etherscan 手动部署
 */
import { CdpClient } from "@coinbase/cdp-sdk"
import { createPublicClient, http, formatEther } from "viem"
import { baseSepolia } from "viem/chains"

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET
const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET
const FUND_ADDRESS = process.env.FUND_ADDRESS || "0x3cA605BF725C64B3C5e38dbA21F25EBcFd1Fcf28"

if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
  console.error("❌ Missing CDP credentials!")
  process.exit(1)
}

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
})

async function main() {
  console.log("═══════════════════════════════════════════════")
  console.log("  Step 1: Fund your address via CDP Faucet")
  console.log("═══════════════════════════════════════════════")
  console.log(`\n🎯 Target: ${FUND_ADDRESS}`)

  const cdp = new CdpClient({
    apiKeyId: CDP_API_KEY_ID!,
    apiKeySecret: CDP_API_KEY_SECRET!,
    walletSecret: CDP_WALLET_SECRET!,
  })

  // Check existing balance
  const balBefore = await publicClient.getBalance({ address: FUND_ADDRESS as any })
  console.log(`💰 Current balance: ${formatEther(balBefore)} ETH`)

  // Request faucet
  console.log("\n🚰 Requesting ETH from CDP faucet...")
  try {
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: FUND_ADDRESS,
      network: "base-sepolia",
      token: "eth",
    })
    console.log(`   Faucet TX: https://sepolia.basescan.org/tx/${transactionHash}`)
    console.log("   ⏳ Waiting...")

    await publicClient.waitForTransactionReceipt({ hash: transactionHash })
    await new Promise((r) => setTimeout(r, 3000))

    const balAfter = await publicClient.getBalance({ address: FUND_ADDRESS as any })
    console.log(`\n✅ New balance: ${formatEther(balAfter)} ETH`)

    console.log("\n═══════════════════════════════════════════════")
    console.log("  Next Steps")
    console.log("═══════════════════════════════════════════════")
    console.log("\nOption A: Deploy via this terminal (need private key):")
    console.log("  DEPLOY_PRIVATE_KEY=0x你的私钥 node scripts/deploy.mjs")
    console.log("\nOption B: Deploy on Remix IDE:")
    console.log("  1. Go to https://remix.ethereum.org")
    console.log("  2. Paste contracts/src/CinaNFT.sol")
    console.log("  3. Compile with Solidity 0.8.24")
    console.log("  4. Deploy to Base Sepolia with MetaMask")
    console.log(`  5. Use this funded address: ${FUND_ADDRESS}`)
  } catch (err: any) {
    console.error("❌ Faucet failed:", err.message)
    process.exit(1)
  }
}

main().catch(console.error)
