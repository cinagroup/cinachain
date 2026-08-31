// Deploy CinaCreditV2 with separate admin, minter and pauser identities.
//
// Records the address into the shared deployment receipt
// (contracts/out/deployment.base-sepolia.json) so verify-contracts.mjs
// picks it up automatically. Idempotent: skips when V2 already has code.
//
// Usage: DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-credit-v2.mjs
import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { createPublicClient, createWalletClient, getAddress, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia } from "viem/chains"

import { requirePrivateKey } from "./lib/keys.mjs"
import { rpcTransport, rpcUrls } from "./lib/rpc.mjs"

const PK = requirePrivateKey(process.env.DEPLOY_PRIVATE_KEY)
const NETWORK =
  process.env.DEPLOY_NETWORK === "base-mainnet"
    ? "base-mainnet"
    : "base-sepolia"
const CHAIN = NETWORK === "base-mainnet" ? base : baseSepolia

const acct = privateKeyToAccount(PK)
function requiredRoleAddress(name) {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error(`${name} is required`)
  try {
    return getAddress(value)
  } catch {
    throw new Error(`${name} must be a valid address`)
  }
}

const ROLE_ADDRESSES = {
  admin: requiredRoleAddress("CINA_CREDIT_ADMIN_ADDRESS"),
  minter: requiredRoleAddress("CINA_CREDIT_MINTER_ADDRESS"),
  pauser: requiredRoleAddress("CINA_CREDIT_PAUSER_ADDRESS"),
}
if (
  new Set(Object.values(ROLE_ADDRESSES).map((value) => value.toLowerCase()))
    .size !== 3
) {
  throw new Error(
    "CinaCredit admin, minter and pauser addresses must be distinct"
  )
}
if (ROLE_ADDRESSES.minter.toLowerCase() === acct.address.toLowerCase()) {
  throw new Error("The online minter must not reuse DEPLOY_PRIVATE_KEY")
}
// Deployment writes pin to the primary endpoint (sequential-tx nonce safety,
// see scripts/setup-tier-badges.mjs); reads use the fallback chain.
const wallet = createWalletClient({
  account: acct,
  chain: CHAIN,
  transport: http(rpcUrls(NETWORK)[0]),
})
const pc = createPublicClient({
  chain: CHAIN,
  transport: rpcTransport(NETWORK),
})

const RECEIPT = resolve(`contracts/out/deployment.${NETWORK}.json`)
const state = existsSync(RECEIPT)
  ? JSON.parse(readFileSync(RECEIPT, "utf8"))
  : {
      network: NETWORK,
      chainId: CHAIN.id,
      deployer: acct.address,
      contracts: {},
      txHashes: {},
    }
if (!state.contracts) state.contracts = {}
if (!state.txHashes) state.txHashes = {}

const art = JSON.parse(
  readFileSync(resolve(`contracts/out/CinaCreditV2.json`), "utf8")
)
const ZERO_ADMIN =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

async function hasCode(address) {
  if (!address) return false
  const code = await pc.getCode({ address })
  return code !== "0x" && code !== undefined && code.length > 2
}

// Code-presence check where "false" must retry: right after a deploy the
// load-balanced RPC can still return no code from a lagging node.
async function awaitCode(address, label, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    if (await hasCode(address)) return true
    console.warn(
      `   ↻ ${label}: not yet visible on this RPC node (retry ${
        i + 1
      }/${attempts})`
    )
    await sleep(2500)
  }
  return false
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function withRetry(label, fn, attempts = 6) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      console.warn(
        `   ↻ ${label}: ${e?.shortMessage ?? e?.message} (retry ${
          i + 1
        }/${attempts})`
      )
      await sleep(2500)
    }
  }
  throw lastErr
}

async function main() {
  console.log(`🌐 Deploying CinaCreditV2 to ${NETWORK} with separated roles`)

  if (
    state.contracts.CinaCreditV2 &&
    (await withRetry("hasCode", () => hasCode(state.contracts.CinaCreditV2)))
  ) {
    console.log(
      `⏭️  CinaCreditV2 already deployed at ${state.contracts.CinaCreditV2} — skipping`
    )
  } else {
    const hash = await wallet.deployContract({
      abi: art.abi,
      bytecode: art.bytecode,
      args: [
        ROLE_ADDRESSES.admin,
        ROLE_ADDRESSES.minter,
        ROLE_ADDRESSES.pauser,
      ],
    })
    console.log(`   TX: ${CHAIN.blockExplorers?.default?.url}/tx/${hash}`)
    const receipt = await pc.waitForTransactionReceipt({ hash })
    if (receipt.status === "reverted")
      throw new Error(`CinaCreditV2 deployment reverted (tx ${hash})`)
    if (!receipt.contractAddress)
      throw new Error("no contract address in receipt")
    state.contracts.CinaCreditV2 = receipt.contractAddress
    state.txHashes.CinaCreditV2 = hash
    state.roleAssignments = {
      ...(state.roleAssignments ?? {}),
      CinaCreditV2: ROLE_ADDRESSES,
    }
    writeFileSync(RECEIPT, JSON.stringify(state, null, 2))
    console.log(
      `   ✅ CinaCreditV2 at ${receipt.contractAddress} (gas ${Number(
        receipt.gasUsed
      ).toLocaleString()})`
    )
  }

  const addr = state.contracts.CinaCreditV2

  // ── On-chain verification: code + separated role grants ──
  console.log("\n🔍 Verifying on-chain state...")
  if (!(await awaitCode(addr, "hasCode(V2)")))
    throw new Error(`no bytecode at ${addr}`)
  console.log(`   ✓ code present at ${addr}`)
  const minterRole = await withRetry("MINTER_ROLE()", () =>
    pc.readContract({
      address: addr,
      abi: art.abi,
      functionName: "MINTER_ROLE",
    })
  )
  const checks = [
    ["DEFAULT_ADMIN_ROLE", ZERO_ADMIN, ROLE_ADDRESSES.admin],
    ["MINTER_ROLE", minterRole, ROLE_ADDRESSES.minter],
    [
      "PAUSER_ROLE",
      await pc.readContract({
        address: addr,
        abi: art.abi,
        functionName: "PAUSER_ROLE",
      }),
      ROLE_ADDRESSES.pauser,
    ],
  ]
  for (const [label, role, expected] of checks) {
    const has = await withRetry(`hasRole(${label})`, () =>
      pc.readContract({
        address: addr,
        abi: art.abi,
        functionName: "hasRole",
        args: [role, expected],
      })
    )
    if (!has) throw new Error(`${expected} lacks ${label}`)
    console.log(`   ✓ ${label}: ${expected}`)
  }
  state.roleAssignments = {
    ...(state.roleAssignments ?? {}),
    CinaCreditV2: ROLE_ADDRESSES,
  }
  writeFileSync(RECEIPT, JSON.stringify(state, null, 2))

  console.log(`\nNEXT_PUBLIC_CINA_CREDIT_CONTRACT=${addr}`)
  console.log(`💾 Receipt updated: ${RECEIPT}`)
}

main().catch((e) => {
  console.error("\n❌ Deployment failed:", e?.shortMessage ?? e?.message ?? e)
  process.exit(1)
})
