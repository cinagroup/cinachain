/**
 * 用 CDP 创建钱包 → faucet 注资 → 转账到部署地址
 * 部署地址有了 ETH 后就可以用 deploy.mjs 部署
 */
import { CdpClient } from "@coinbase/cdp-sdk"
import { createPublicClient, http, formatEther, parseEther } from "viem"
import { baseSepolia } from "viem/chains"

const TARGET = process.argv[2] || "0xa1fBED1846E1fA0d7c1D44f60195F2Fc3dC23060"

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
})

async function main() {
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
  })

  console.log("🔑 Creating temporary CDP wallet...")
  const account = await cdp.evm.createAccount()
  console.log("   Address:", account.address)

  console.log("\n🚰 Faucet...")
  const { transactionHash: fHash } = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth",
  })
  console.log("   TX:", fHash)
  await publicClient.waitForTransactionReceipt({ hash: fHash })
  await new Promise((r) => setTimeout(r, 5000))

  const bal = await publicClient.getBalance({ address: account.address })
  console.log("   Balance:", formatEther(bal), "ETH")

  console.log(`\n💸 Transferring to ${TARGET}...`)
  const sendAmount = bal - parseEther("0.00003") // leave tiny bit for gas

  const { transactionHash: tHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",
    transaction: {
      to: TARGET as `0x${string}`,
      value: sendAmount,
    },
  })

  console.log("   TX:", tHash)
  console.log("   ⏳ Waiting...")
  await publicClient.waitForTransactionReceipt({ hash: tHash })

  const targetBal = await publicClient.getBalance({ address: TARGET as any })
  console.log(`\n✅ Target balance: ${formatEther(targetBal)} ETH`)
}

main().catch((e) => { console.error("❌", e.message); process.exit(1) })
