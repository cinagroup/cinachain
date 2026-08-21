// One-shot deployment orchestrator: all four CinaChain contracts + Mega
// template initialization/locking on Base Sepolia (or Base mainnet).
//
// Usage (same env contract as the individual scripts):
//   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-all.mjs
//   DEPLOY_NETWORK=base-sepolia | base-mainnet (default base-sepolia)
//   MEGA_MINT_CAP=1000000 (default)
//
// Safe to re-run: progress is persisted to
//   contracts/out/deployment.<network>.json
// after EVERY step; already-deployed contracts (on-chain code present) are
// skipped, and Mega templates are only initialized when svgLocked() is false.
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem"
import { base, baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { spawnSync } from "node:child_process"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK || !PK.startsWith("0x")) throw new Error("DEPLOY_PRIVATE_KEY required (0x...)")
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base-mainnet" : "base-sepolia"
const CHAIN = NETWORK === "base-mainnet" ? base : baseSepolia
const RPC = process.env.DEPLOY_RPC_URL || (NETWORK === "base-mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org")
const MINT_CAP = BigInt(process.env.MEGA_MINT_CAP ?? "1000000")

const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: CHAIN, transport: http(RPC) })
const wc = createWalletClient({ account: acct, chain: CHAIN, transport: http(RPC) })

const RECEIPT = resolve(`contracts/out/deployment.${NETWORK}.json`)
const loadArt = (name) => JSON.parse(readFileSync(resolve(`contracts/out/${name}.json`), "utf8"))

const state = existsSync(RECEIPT)
  ? JSON.parse(readFileSync(RECEIPT, "utf8"))
  : { network: NETWORK, chainId: CHAIN.id, deployer: acct.address, contracts: {}, txHashes: {} }

function persist() {
  writeFileSync(RECEIPT, JSON.stringify(state, null, 2))
}

async function hasCode(address) {
  if (!address) return false
  const code = await pc.getCode({ address })
  return code !== "0x" && code !== undefined && code.length > 2
}

async function deploy(contractName, args) {
  if (state.contracts[contractName] && (await hasCode(state.contracts[contractName]))) {
    console.log(`⏭️  ${contractName} already deployed at ${state.contracts[contractName]} — skipping`)
    return state.contracts[contractName]
  }
  const art = loadArt(contractName)
  console.log(`\n📦 Deploying ${contractName}...`)
  const hash = await wc.deployContract({ abi: art.abi, bytecode: art.bytecode, args })
  console.log(`   TX: ${CHAIN.blockExplorers?.default?.url}/tx/${hash}`)
  const receipt = await pc.waitForTransactionReceipt({ hash })
  if (receipt.status === "reverted") throw new Error(`${contractName} deployment reverted (tx ${hash})`)
  const address = receipt.contractAddress
  if (!address) throw new Error(`${contractName}: no contract address in receipt`)
  state.contracts[contractName] = address
  state.txHashes[contractName] = hash
  persist()
  console.log(`   ✅ ${contractName} at ${address} (gas ${Number(receipt.gasUsed).toLocaleString()})`)
  return address
}

function summary(title) {
  const c = state.contracts
  const block = [
    `## ${title}`,
    "",
    `Network: **${NETWORK}** (chainId ${CHAIN.id}) · Deployer: \`${state.deployer}\``,
    "",
    `| Contract | Address | Explorer |`,
    `|---|---|---|`,
    ...Object.entries(c).map(
      ([n, a]) => `| ${n} | \`${a}\` | [link](${CHAIN.blockExplorers?.default?.url}/address/${a}) |`
    ),
    "",
    "```",
    `NEXT_PUBLIC_CINA_NFT_CONTRACT=${c.CinaNFT ?? ""}`,
    `NEXT_PUBLIC_CINA_ERC1155_CONTRACT=${c.CinaBadge ?? ""}`,
    `NEXT_PUBLIC_CINA_CREDIT_CONTRACT=${c.CinaCredit ?? ""}`,
    `NEXT_PUBLIC_CINA_MEGA_CONTRACT=${c.CinaMega ?? ""}`,
    "```",
  ].join("\n")
  console.log("\n" + block + "\n")
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, block + "\n", { flag: "a" })
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════")
  console.log(`  CinaChain full deployment — ${NETWORK}`)
  console.log(`  RPC: ${RPC}`)
  console.log(`  Deployer: ${acct.address}`)
  console.log("═══════════════════════════════════════════════")

  const balance = await pc.getBalance({ address: acct.address })
  console.log(`\n💰 Balance: ${formatEther(balance)} ETH`)
  if (balance === 0n) {
    throw new Error("No ETH balance — fund the deployer first (see contracts/DEPLOY.md §前置要求)")
  }
  // ~13-15M gas for the full flow; warn well below the comfortable margin.
  if (balance < parseEther("0.00005")) {
    console.warn(`⚠️  Balance below 0.00005 ETH — the full deployment needs ~0.0001 ETH. It may run out partway (resume by re-running).`)
  }

  // Args mirror scripts/deploy.mjs / deploy-mega.mjs exactly.
  await deploy("CinaNFT", ["CinaChain NFT", "CINA", 10000n, parseEther("0.001"), acct.address])
  await deploy("CinaBadge", ["ipfs://QmBadges/{id}.json", acct.address])
  await deploy("CinaCredit", [acct.address, 1000000n, acct.address, 200n])
  const megaAddr = await deploy("CinaMega", [acct.address, MINT_CAP])

  // ── Mega templates: init + irreversible lock (skipped if already locked) ──
  const megaAbi = loadArt("CinaMega").abi
  const locked = await pc.readContract({ address: megaAddr, abi: megaAbi, functionName: "svgLocked" })
  if (locked) {
    console.log("\n⏭️  Mega templates already locked — skipping init")
  } else {
    console.log("\n🎨 Initializing Mega templates (SVG + CID) and locking...")
    const res = spawnSync(process.execPath, [resolve("scripts/init-mega-templates.mjs")], {
      stdio: "inherit",
      env: {
        ...process.env,
        CINA_MEGA_CONTRACT: megaAddr,
        // The default RPC in init-mega-templates differs; keep it consistent.
        DEPLOY_RPC_URL: RPC === "https://sepolia.base.org" ? "https://base-sepolia-rpc.publicnode.com" : RPC,
      },
    })
    if (res.status !== 0) throw new Error("init-mega-templates.mjs failed — re-run to resume")
  }

  // ── Final on-chain verification ──
  console.log("\n🔍 Verifying on-chain state...")
  for (const name of Object.keys(state.contracts)) {
    if (!(await hasCode(state.contracts[name]))) throw new Error(`${name}: no bytecode at ${state.contracts[name]}`)
    console.log(`   ✓ ${name} code present at ${state.contracts[name]}`)
  }
  const megaLocked2 = await pc.readContract({ address: megaAddr, abi: megaAbi, functionName: "svgLocked" })
  if (!megaLocked2) throw new Error("CinaMega templates not locked after init")
  console.log("   ✓ CinaMega templates locked")
  const creditOwner = await pc.readContract({
    address: state.contracts.CinaCredit, abi: loadArt("CinaCredit").abi, functionName: "owner",
  })
  if (creditOwner.toLowerCase() !== acct.address.toLowerCase()) throw new Error("CinaCredit owner mismatch")
  console.log("   ✓ CinaCredit owner = deployer")

  state.completedAt = new Date().toISOString()
  persist()
  summary("✅ CinaChain contracts deployed")
  console.log(`💾 Receipt: ${RECEIPT}`)
}

main().catch((e) => {
  console.error("\n❌ Deployment failed:", e?.shortMessage ?? e?.message ?? e)
  console.error("   Progress is saved — fix the issue and re-run to resume.")
  process.exit(1)
})
