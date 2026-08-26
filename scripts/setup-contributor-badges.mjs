/**
 * 创建 4 个 cinatoken 贡献位阶徽章（CinaBadge IDs 105-108，soulbound）。
 * 与 100-104 的消耗位阶（setup-tier-badges）同合约、分段编号：
 *   100-104 cinachain billing 消耗位阶（Bronze..Whale）
 *   105-108 cinatoken 共享 key 贡献位阶（Contributor Bronze..Platinum）
 * ID 由 nextCustomBadgeId 递增分配——必须先跑 setup-tier-badges（100-104）再跑本脚本。
 * 用法: DEPLOY_PRIVATE_KEY=0x... CINA_BADGE_CONTRACT=0x... node scripts/setup-contributor-badges.mjs
 */
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { rpcTransport, rpcUrls } from "./lib/rpc.mjs"

// Tolerate secret-storage quirks (whitespace/quotes/missing 0x) — same
// normalization as scripts/deploy-all.mjs.
function normalizePrivateKey(raw) {
  const k = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim()
  if (/^[0-9a-fA-F]{64}$/.test(k)) return "0x" + k
  return k
}
const PK = normalizePrivateKey(process.env.DEPLOY_PRIVATE_KEY)
if (!/^0x[0-9a-fA-F]{64}$/.test(PK)) throw new Error("DEPLOY_PRIVATE_KEY invalid (0x + 64 hex)")
const BADGE = process.env.CINA_BADGE_CONTRACT || "0x0a32fc1302bf7765b386de5eae857c26d6c8e0ce"
// Sequential writes pin to the primary endpoint with an explicit pending
// nonce (see setup-tier-badges.mjs for the fallback-chain nonce rationale).
const account = privateKeyToAccount(PK)
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrls("base-sepolia")[0]) })
const publicClient = createPublicClient({ chain: baseSepolia, transport: rpcTransport("base-sepolia") })

const BADGE_ABI = [
  { name: "createBadgeType", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }, { name: "description", type: "string" },
             { name: "soulbound", type: "bool" }, { name: "maxSupply", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "badgeTypeCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
]

// Metadata mirrors cinatoken scripts/cinachain/setup-tier-badges.mjs
// (thresholds are contribution values in the cinatoken marketplace).
const TIERS = [
  { name: "CinaToken Contributor Bronze", description: "cinatoken shared-key contribution: Bronze (threshold 10)" },
  { name: "CinaToken Contributor Silver", description: "cinatoken shared-key contribution: Silver (threshold 50)" },
  { name: "CinaToken Contributor Gold", description: "cinatoken shared-key contribution: Gold (threshold 200)" },
  { name: "CinaToken Contributor Platinum", description: "cinatoken shared-key contribution: Platinum (threshold 1000)" },
]

const count = Number(await publicClient.readContract({ address: BADGE, abi: BADGE_ABI, functionName: "badgeTypeCount" }))
const custom = Math.max(0, count - 5)
if (custom < 5) {
  throw new Error(`消耗位阶 100-104 尚未创建（custom=${custom}）— 先运行 setup-tier-badges`)
}
if (custom >= 9) {
  console.log(`✔ 贡献位阶已存在（custom count=${custom}），预期 IDs 105-108，跳过`)
  process.exit(0)
}
let nonce = Number(await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }))
for (let i = custom - 5; i < 4; i++) {
  const t = TIERS[i]
  const hash = await wallet.writeContract({
    address: BADGE, abi: BADGE_ABI, functionName: "createBadgeType",
    args: [t.name, t.description, true, 0n], // soulbound, unlimited
    nonce: nonce++,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") {
    console.error(`❌ ${t.name} badge creation REVERTED (check owner key / pause state)`)
    process.exit(1)
  }
  console.log(`✔ ${t.name} badge created id=#${105 + i} tx=${hash}`)
}
