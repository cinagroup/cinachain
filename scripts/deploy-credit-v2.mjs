// Deploy CinaCreditV2 to Base Sepolia (EOA-first: the deployer holds all
// three roles; the multisig takes over via grantRole/revokeRole before
// mainnet — docs/superpowers/specs/2026-08-26-cinacredit-v2-design.md).
//
// Records the address into the shared deployment receipt
// (contracts/out/deployment.base-sepolia.json) so verify-contracts.mjs
// picks it up automatically. Idempotent: skips when V2 already has code.
//
// Usage: DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-credit-v2.mjs
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia, base } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { rpcTransport, rpcUrls } from "./lib/rpc.mjs"
import { requirePrivateKey } from "./lib/keys.mjs"

const PK = requirePrivateKey(process.env.DEPLOY_PRIVATE_KEY)
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base-mainnet" : "base-sepolia"
const CHAIN = NETWORK === "base-mainnet" ? base : baseSepolia

const acct = privateKeyToAccount(PK)
// Deployment writes pin to the primary endpoint (sequential-tx nonce safety,
// see scripts/setup-tier-badges.mjs); reads use the fallback chain.
const wallet = createWalletClient({ account: acct, chain: CHAIN, transport: http(rpcUrls(NETWORK)[0]) })
const pc = createPublicClient({ chain: CHAIN, transport: rpcTransport(NETWORK) })

const RECEIPT = resolve(`contracts/out/deployment.${NETWORK}.json`)
const state = existsSync(RECEIPT)
  ? JSON.parse(readFileSync(RECEIPT, "utf8"))
  : { network: NETWORK, chainId: CHAIN.id, deployer: acct.address, contracts: {}, txHashes: {} }
if (!state.contracts) state.contracts = {}
if (!state.txHashes) state.txHashes = {}

const art = JSON.parse(readFileSync(resolve(`contracts/out/CinaCreditV2.json`), "utf8"))
const ZERO_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000"

async function hasCode(address) {
  if (!address) return false
  const code = await pc.getCode({ address })
  return code !== "0x" && code !== undefined && code.length > 2
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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

async function main() {
  console.log(`🌐 Deploying CinaCreditV2 to ${NETWORK} — EOA-first roles for ${acct.address}`)

  if (state.contracts.CinaCreditV2 && (await withRetry("hasCode", () => hasCode(state.contracts.CinaCreditV2)))) {
    console.log(`⏭️  CinaCreditV2 already deployed at ${state.contracts.CinaCreditV2} — skipping`)
  } else {
    const hash = await wallet.deployContract({
      abi: art.abi,
      bytecode: art.bytecode,
      // EOA-first: deployer = admin = minter = pauser (multisig takeover later)
      args: [acct.address, acct.address, acct.address],
    })
    console.log(`   TX: ${CHAIN.blockExplorers?.default?.url}/tx/${hash}`)
    const receipt = await pc.waitForTransactionReceipt({ hash })
    if (receipt.status === "reverted") throw new Error(`CinaCreditV2 deployment reverted (tx ${hash})`)
    if (!receipt.contractAddress) throw new Error("no contract address in receipt")
    state.contracts.CinaCreditV2 = receipt.contractAddress
    state.txHashes.CinaCreditV2 = hash
    writeFileSync(RECEIPT, JSON.stringify(state, null, 2))
    console.log(`   ✅ CinaCreditV2 at ${receipt.contractAddress} (gas ${Number(receipt.gasUsed).toLocaleString()})`)
  }

  const addr = state.contracts.CinaCreditV2

  // ── On-chain verification: code + EOA-first role grants ──
  console.log("\n🔍 Verifying on-chain state...")
  if (!(await withRetry("hasCode(V2)", () => hasCode(addr)))) throw new Error(`no bytecode at ${addr}`)
  console.log(`   ✓ code present at ${addr}`)
  const minterRole = await withRetry("MINTER_ROLE()", () =>
    pc.readContract({ address: addr, abi: art.abi, functionName: "MINTER_ROLE" })
  )
  const checks = [
    ["DEFAULT_ADMIN_ROLE", ZERO_ADMIN],
    ["MINTER_ROLE", minterRole],
    ["PAUSER_ROLE", await pc.readContract({ address: addr, abi: art.abi, functionName: "PAUSER_ROLE" })],
  ]
  for (const [label, role] of checks) {
    const has = await withRetry(`hasRole(${label})`, () =>
      pc.readContract({ address: addr, abi: art.abi, functionName: "hasRole", args: [role, acct.address] })
    )
    if (!has) throw new Error(`deployer lacks ${label}`)
    console.log(`   ✓ deployer holds ${label}`)
  }
  writeFileSync(RECEIPT, JSON.stringify(state, null, 2))

  console.log(`\nNEXT_PUBLIC_CINA_CREDIT_CONTRACT=${addr}`)
  console.log(`💾 Receipt updated: ${RECEIPT}`)
}

main().catch((e) => {
  console.error("\n❌ Deployment failed:", e?.shortMessage ?? e?.message ?? e)
  process.exit(1)
})
