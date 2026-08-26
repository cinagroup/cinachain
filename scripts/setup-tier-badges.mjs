/**
 * 创建 5 个等级徽章类型（CinaBadge IDs 100-104，soulbound）。
 * CinaBadge.nextCustomBadgeId 从 100 起，按创建顺序分配。
 * 用法: DEPLOY_PRIVATE_KEY=0x... CINA_BADGE_CONTRACT=0x... node scripts/setup-tier-badges.mjs
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
// Sequential writes must NOT go through the multi-endpoint fallback chain:
// back-to-back transactions can hit a node that has not seen the previous
// one yet, reusing a stale nonce ("replacement transaction underpriced").
// Reads keep the chain; writes pin to the primary endpoint with an
// explicitly managed pending-nonce.
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

const TIERS = [
  { name: "Bronze", description: "累计消耗 1 万 Credit", },
  { name: "Silver", description: "累计消耗 10 万 Credit", },
  { name: "Gold", description: "累计消耗 100 万 Credit", },
  { name: "Diamond", description: "累计消耗 1000 万 Credit", },
  { name: "Whale", description: "累计消耗 1 亿 Credit", },
]

const count = await publicClient.readContract({ address: BADGE, abi: BADGE_ABI, functionName: "badgeTypeCount" })
// count = 5 标准 + custom；已创建 5 个自定义则跳过
const custom = Math.max(0, Number(count) - 5)
if (custom >= 5) {
  console.log(`✔ 等级徽章已存在（custom count=${custom}），预期 IDs 100-104，跳过`)
  process.exit(0)
}
// Pending-nonce so consecutive writes never reuse a mined tx's slot.
let nonce = Number(await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }))
for (let i = custom; i < 5; i++) {
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
  console.log(`✔ ${t.name} badge created id=#${100 + i} tx=${hash}`)
}
