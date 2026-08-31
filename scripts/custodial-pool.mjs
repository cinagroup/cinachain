/**
 * 托管池工具：仅保留 owner 向已安全托管的钱包注资。
 *
 * 钱包生成和提现已禁用：旧流程会把私钥输出到终端/命令行，并且
 * 先转账后人工扣账，无法提供幂等和原子余额保障。
 * 用法:
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/custodial-pool.mjs fund <pool> <creditAmount>
 */
import { createPublicClient, createWalletClient, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
const CREDIT =
  process.env.CINA_CREDIT_CONTRACT ||
  "0x22f3e0aaa4785169d2c227d37df17c168fbae85a"
const MODE = process.argv[2]
const chain = baseSepolia

const CREDIT_ABI = [
  {
    name: "mintTo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
]

if (MODE === "gen") {
  throw new Error(
    "gen is disabled: create the pool in a managed signer or encrypted keystore; never print a private key"
  )
}
if (MODE === "withdraw") {
  throw new Error(
    "withdraw is disabled until a transactional withdrawal state machine with reservation and idempotency is deployed"
  )
}

if (MODE !== "fund") {
  throw new Error("用法: fund <pool> <credits>")
}
const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("需要 DEPLOY_PRIVATE_KEY")
const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain, transport: http(RPC) })
const publicClient = createPublicClient({ chain, transport: http(RPC) })

const pool = process.argv[3]
if (!/^0x[a-fA-F0-9]{40}$/.test(pool ?? "")) {
  throw new Error("pool 必须是有效地址")
}
const credits = parseEther(process.argv[4] ?? "1") // 1 credit = 1e18
const hash = await wallet.writeContract({
  address: CREDIT,
  abi: CREDIT_ABI,
  functionName: "mintTo",
  args: [pool, credits],
})
const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status === "reverted") {
  console.error(`❌ 交易回滚（检查 minter key / 暂停状态）`)
  process.exit(1)
}
console.log(`✔ 已向池 ${pool} 注资 ${process.argv[4] ?? "1"} credit tx=${hash}`)
