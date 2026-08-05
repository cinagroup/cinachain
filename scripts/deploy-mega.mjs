// Deploy CinaMega to Base Sepolia (default) or Base mainnet.
// Usage:
//   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-mega.mjs
//   DEPLOY_NETWORK=base-mainnet node scripts/deploy-mega.mjs
//
// Templates (SVG + CID) are NOT written here — run init-mega-templates.mjs
// AFTER mega-assets/cids.json exists (4EVERLAND upload, T2) so the immutable
// on-chain data is never seeded with a placeholder CID.
import { readFileSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia, base } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base" : "base-sepolia"
const CHAIN = NETWORK === "base" ? base : baseSepolia
const RPC = NETWORK === "base" ? "https://mainnet.base.org" : "https://sepolia.base.org"
// Anti-sybil cap for the free ucina mint (default 1M per address).
const MINT_CAP = BigInt(process.env.MEGA_MINT_CAP ?? "1000000")

const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: CHAIN, transport: http(RPC) })
const wc = createWalletClient({ account: acct, chain: CHAIN, transport: http(RPC) })
const mega = JSON.parse(readFileSync(resolve("contracts/out/CinaMega.json"), "utf8"))

async function main() {
  console.log(`🌐 Deploying CinaMega to ${NETWORK} (${RPC})`)
  console.log(`   owner: ${acct.address}`)
  console.log(`   mintCapPerAddress: ${MINT_CAP}`)

  const hash = await wc.deployContract({
    abi: mega.abi,
    bytecode: mega.bytecode,
    args: [acct.address, MINT_CAP],
  })
  const receipt = await pc.waitForTransactionReceipt({ hash })
  const addr = receipt.contractAddress
  if (!addr) throw new Error("no contract address in receipt")
  console.log(`\n✅ CinaMega deployed: ${addr}`)
  console.log(`   tx: ${CHAIN.blockExplorers?.default?.url}/tx/${hash}`)
  console.log("\n📋 Next steps:")
  console.log("   1. NEXT_PUBLIC_CINA_MEGA_CONTRACT=" + addr + "  (add to .env.local/.env.production + lib/contracts/addresses.ts)")
  console.log("   2. Run scripts/generate-mega-assets.mjs then upload to 4EVERLAND (T2)")
  console.log("   3. Run scripts/init-mega-templates.mjs to write SVG/CID + lock")
}

main().catch((e) => {
  console.error("❌ Deploy failed:", e?.shortMessage ?? e?.message ?? e)
  process.exit(1)
})
