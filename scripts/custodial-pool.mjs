/**
 * 托管池工具：生成池钱包（本地保存）、owner 向池 mintTo 注资、池向用户转账（提现）。
 * 用法:
 *   node scripts/custodial-pool.mjs gen            # 生成池私钥（打印，自行保存）
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/custodial-pool.mjs fund <pool> <creditAmount>
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/custodial-pool.mjs withdraw <poolKey> <to> <creditAmount>
 */
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"

const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
const CREDIT = process.env.CINA_CREDIT_CONTRACT || "0x03a5637a465707ccd59dce16c1965f4ac84b495a"
const MODE = process.argv[2]
const chain = baseSepolia

const CREDIT_ABI = [
  { name: "mintTo", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
]

if (MODE === "gen") {
  console.log(`池私钥（妥善保存，勿提交仓库）: ${generatePrivateKey()}`)
  process.exit(0)
}

const PK = process.env.DEPLOY_PRIVATE_KEY || (MODE === "withdraw" ? process.argv[3] : null)
if (!PK) throw new Error("需要 DEPLOY_PRIVATE_KEY（fund）或池私钥（withdraw）")
const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain, transport: http(RPC) })
const publicClient = createPublicClient({ chain, transport: http(RPC) })

if (MODE === "fund") {
  const pool = process.argv[3]
  const credits = parseEther(process.argv[4] ?? "1") // 1 credit = 1e18
  const hash = await wallet.writeContract({ address: CREDIT, abi: CREDIT_ABI, functionName: "mintTo", args: [pool, credits] })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") {
    console.error(`❌ 交易回滚（检查 owner key / 暂停状态）`)
    process.exit(1)
  }
  console.log(`✔ 已向池 ${pool} 注资 ${process.argv[4] ?? "1"} credit tx=${hash}`)
} else if (MODE === "withdraw") {
  const poolKey = process.argv[3]
  const to = process.argv[4]
  const credits = parseEther(process.argv[5] ?? "1")
  const pool = privateKeyToAccount(poolKey)
  const poolWallet = createWalletClient({ account: pool, chain, transport: http(RPC) })
  const hash = await poolWallet.writeContract({ address: CREDIT, abi: CREDIT_ABI, functionName: "transfer", args: [to, credits] })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") {
    console.error(`❌ 交易回滚（检查 owner key / 暂停状态）`)
    process.exit(1)
  }
  console.log(`✔ 池已转 ${process.argv[5] ?? "1"} credit -> ${to} tx=${hash}`)
  console.log(`   ⚠ 链上转账后请扣减 DB 余额:`)
  console.log(`     curl -X POST $BILLING_URL/v1/custodial/debit -H "X-Admin-Key: $ADMIN_KEY" -H "Content-Type: application/json" -d '{"id":"<custId>","amountWei":"${credits}"}'`)
} else {
  console.error("用法: gen | fund <pool> <credits> | withdraw <poolKey> <to> <credits>")
  process.exit(1)
}
