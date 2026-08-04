/**
 * 扫描 worker 中 status=minting 的 Key 入金记录 → owner 链上铸造 CinaCredit → 确认闭环。
 * 用法: DEPLOY_PRIVATE_KEY=0x... BILLING_URL=... ADMIN_KEY=... node scripts/ingress-mint.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BILLING_URL = process.env.BILLING_URL || "https://cinachain-billing.cinagroup.workers.dev"
const ADMIN_KEY = process.env.ADMIN_KEY
const CREDIT = process.env.CINA_CREDIT_CONTRACT || "0x78f5aebc75b7d197b10622cccabe8429617836d7"
const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
if (!PK || !ADMIN_KEY) throw new Error("DEPLOY_PRIVATE_KEY and ADMIN_KEY required")

const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

const MINT_ABI = [
  { name: "mintTo", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
]

// 1 micro-credit = 1e12 wei (与 worker WEI_PER_MICRO 一致)
const WEI_PER_MICRO = 1_000_000_000_000n

const res = await fetch(`${BILLING_URL}/v1/admin/ingress?status=minting`, { headers: { "X-Admin-Key": ADMIN_KEY } })
if (!res.ok) throw new Error(`admin/ingress ${res.status}: ${await res.text()}`)
const { records } = await res.json()
if (!records.length) { console.log("✔ 无待铸造入金记录"); process.exit(0) }

for (const rec of records) {
  const amountWei = BigInt(rec.confirmedMicro) * WEI_PER_MICRO
  const hash = await wallet.writeContract({
    address: CREDIT, abi: MINT_ABI, functionName: "mintTo",
    args: [rec.owner, amountWei],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") {
    console.error(`❌ mintTo REVERTED for ${rec.id} (${rec.owner}) — 跳过确认`)
    continue
  }
  console.log(`✔ 入金 ${rec.id} -> ${rec.owner} ${amountWei} wei tx=${hash}`)
  const confirm = await fetch(`${BILLING_URL}/v1/ingress/${rec.id}/confirm`, {
    method: "POST",
    headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: hash }),
  })
  if (!confirm.ok) console.warn(`⚠ confirm failed for ${rec.id}: ${await confirm.text()}`)
}
console.log("✔ 全部入金铸造完成")
