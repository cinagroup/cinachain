/**
 * 扫描 worker 中 status=minting 的 Key 入金记录 → owner 链上铸造 CinaCredit → 确认闭环。
 * 用法: DEPLOY_PRIVATE_KEY=0x... BILLING_URL=... ADMIN_KEY=... node scripts/ingress-mint.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BILLING_URL = process.env.BILLING_URL || "https://billing-api.cinachain.com"
const ADMIN_KEY = process.env.ADMIN_KEY
const CREDIT = process.env.CINA_CREDIT_CONTRACT || "0x22f3e0aaa4785169d2c227d37df17c168fbae85a"
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

let hadFailures = false
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
  const confirmBody = JSON.stringify({ txHash: hash })
  let confirmed = false
  for (let attempt = 0; attempt < 3; attempt++) {
    const confirm = await fetch(`${BILLING_URL}/v1/ingress/${rec.id}/confirm`, {
      method: "POST",
      headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" },
      body: confirmBody,
    })
    if (confirm.ok) { confirmed = true; break }
    console.warn(`⚠ confirm attempt ${attempt + 1} failed for ${rec.id} (${confirm.status}) — retrying`)
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  // 确认失败后记录停留在 minting：重跑会按同一 confirmedMicro 再次 mintTo，必须先人工核对链上 txHash 再处理
  if (!confirmed) {
    hadFailures = true
    console.error(`❌ confirm FAILED after 3 attempts for ${rec.id} — record stays minting; check tx ${hash} before re-running`)
  }
}
if (hadFailures) {
  console.error("❌ 部分入金记录确认失败 — 请人工核对 txHash 后重新运行")
  process.exitCode = 1
} else {
  console.log("✔ 全部入金铸造完成")
}
