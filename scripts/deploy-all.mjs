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

// Tolerate common secret-storage quirks (leading/trailing whitespace,
// surrounding quotes, missing 0x prefix) without ever logging the value.
function normalizePrivateKey(raw) {
  const k = (raw ?? "").trim().replace(/^["']+|["']+$/g, "").trim()
  if (/^[0-9a-fA-F]{64}$/.test(k)) return "0x" + k
  return k
}
const PK = normalizePrivateKey(process.env.DEPLOY_PRIVATE_KEY)
if (!/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  throw new Error(
    "DEPLOY_PRIVATE_KEY invalid — expected 0x + 64 hex chars (quotes/whitespace trimmed, 0x auto-added). Re-save the GitHub secret with the raw exported key."
  )
}
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Public Base Sepolia RPC endpoints occasionally lag a block or two behind
// each other behind the load balancer — a read right after a deploy can hit
// a node that has not indexed the new contract yet ("0x" result). Retry
// reads with backoff instead of failing the deployment.
async function withRetry(label, fn, attempts = 6) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      console.warn(`   ↻ ${label}: ${e?.shortMessage ?? e?.message} (retry ${i + 1}/${attempts})`)
      await sleep(2500)
    }
  }
  throw lastErr
}

async function deploy(contractName, args) {
  if (state.contracts[contractName] && (await withRetry(`hasCode(${contractName})`, () => hasCode(state.contracts[contractName])))) {
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
  const locked = await withRetry("svgLocked()", () =>
    pc.readContract({ address: megaAddr, abi: megaAbi, functionName: "svgLocked" })
  )
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
    const ok = await withRetry(`hasCode(${name})`, () => hasCode(state.contracts[name]))
    if (!ok) throw new Error(`${name}: no bytecode at ${state.contracts[name]}`)
    console.log(`   ✓ ${name} code present at ${state.contracts[name]}`)
  }
  const megaLocked2 = await withRetry("svgLocked()", () =>
    pc.readContract({ address: megaAddr, abi: megaAbi, functionName: "svgLocked" })
  )
  if (!megaLocked2) throw new Error("CinaMega templates not locked after init")
  console.log("   ✓ CinaMega templates locked")
  const creditOwner = await withRetry("CinaCredit.owner()", () =>
    pc.readContract({ address: state.contracts.CinaCredit, abi: loadArt("CinaCredit").abi, functionName: "owner" })
  )
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
