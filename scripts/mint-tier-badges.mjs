/**
 * 读取 worker pending 等级徽章 → owner 链上铸造 → 回写确认。
 * 用法: DEPLOY_PRIVATE_KEY=0x... BILLING_URL=... ADMIN_KEY=... node scripts/mint-tier-badges.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
const BILLING_URL = process.env.BILLING_URL || "https://billing-api.cinachain.com"
const ADMIN_KEY = process.env.ADMIN_KEY
const BADGE = process.env.CINA_BADGE_CONTRACT || "0x72cc9adb6c877d233e9843ee2d00424b9766d0cf"
const RPC = process.env.DEPLOY_RPC_URL || "https://sepolia.base.org"
if (!PK || !ADMIN_KEY) throw new Error("DEPLOY_PRIVATE_KEY and ADMIN_KEY required")

const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) })

const MINT_ABI = [
  { name: "mint", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: [] },
]

// tier -> badge id（与 billing-core TIER_BADGE_IDS 一致）
const TIER_IDS = { bronze: 100n, silver: 101n, gold: 102n, diamond: 103n, whale: 104n }

const res = await fetch(`${BILLING_URL}/v1/admin/pending-badges`, { headers: { "X-Admin-Key": ADMIN_KEY } })
if (!res.ok) throw new Error(`pending-badges ${res.status}: ${await res.text()}`)
const { pending } = await res.json()
if (!pending.length) { console.log("✔ 无待铸造等级徽章"); process.exit(0) }

for (const item of pending) {
  for (const tier of item.badges) {
    const hash = await wallet.writeContract({
      address: BADGE, abi: MINT_ABI, functionName: "mint",
      args: [item.address, TIER_IDS[tier], 1n],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status === "reverted") {
      console.error(`❌ ${tier} badge mint REVERTED for ${item.address} — skipping confirm`)
      continue
    }
    console.log(`✔ ${tier} badge -> ${item.address} tx=${hash}`)
    const confirm = await fetch(
      `${BILLING_URL}/v1/admin/badges/${item.address}/${tier}/confirm`,
      {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, ...(item.custId ? { custId: item.custId } : {}) }),
      }
    )
    if (!confirm.ok) console.warn(`⚠ confirm failed for ${tier} ${item.address}: ${await confirm.text()}`)
  }
}
console.log("✔ 全部等级徽章已铸造并确认")
