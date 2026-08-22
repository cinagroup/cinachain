// Verify the deployed CinaChain contracts on Basescan (Etherscan V2 API).
//
// Submits the EXACT standard-json input used for deployment
// (scripts/lib/compile-input.mjs — same source keys, same import rewriting,
// same optimizer settings, same solc), so the metadata hash in the bytecode
// matches and verification succeeds. A local pre-flight recompiles with
// extra outputSelection and compares the runtime bytecode (with immutable
// slots masked) against the chain before anything is submitted.
//
// Usage:
//   ETHERSCAN_API_KEY=... node scripts/verify-contracts.mjs
//   DRY_RUN=1 node scripts/verify-contracts.mjs   # pre-flight only
//
// Requires contracts/out/deployment.<network>.json (the deploy receipt) —
// download it from the deploy-contracts run artifact if missing.
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createRequire } from "module"
import { createPublicClient, http, encodeAbiParameters, parseAbiParameters } from "viem"
import { base, baseSepolia } from "viem/chains"
import { ROOT, buildCompileInput, etherscanCompilerVersion } from "./lib/compile-input.mjs"

const require = createRequire(import.meta.url)
const solc = require("solc")

const API_KEY = process.env.ETHERSCAN_API_KEY ?? process.env.BASESCAN_API_KEY
const DRY_RUN = process.env.DRY_RUN === "1"
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base-mainnet" : "base-sepolia"
const CHAIN = NETWORK === "base-mainnet" ? base : baseSepolia
// sepolia.base.org has been rejecting GitHub runner requests during
// verification runs; publicnode served the deploy run's checks reliably.
const RPC = process.env.DEPLOY_RPC_URL || (NETWORK === "base-mainnet" ? "https://mainnet.base.org" : "https://base-sepolia-rpc.publicnode.com")
const CHAINID = CHAIN.id // Etherscan V2 chainid (8453 / 84532)
const EXPLORER = CHAIN.blockExplorers?.default?.url

const RECEIPT = resolve(ROOT, `contracts/out/deployment.${NETWORK}.json`)
if (!existsSync(RECEIPT)) {
  throw new Error(`${RECEIPT} not found — download it from the deploy-contracts run artifact first`)
}
const receipt = JSON.parse(readFileSync(RECEIPT, "utf8"))
if (!receipt.contracts || Object.keys(receipt.contracts).length === 0) {
  throw new Error("receipt has no deployed contracts")
}
const DEPLOYER = receipt.deployer

const MINT_PRICE_WEI = 10n ** 15n // 0.001 ETH
// Constructor args must mirror scripts/deploy-all.mjs exactly.
const argSpec = {
  CinaNFT: (deployer) => ["CinaChain NFT", "CINA", 10000n, MINT_PRICE_WEI, deployer],
  CinaBadge: (deployer) => ["ipfs://QmBadges/{id}.json", deployer],
  CinaCredit: (deployer) => [deployer, 1000000n, deployer, 200n],
  CinaMega: (deployer) => [deployer, 1000000n],
}

const pc = createPublicClient({ chain: CHAIN, transport: http(RPC, { retryCount: 5, retryDelay: 2000 }) })

// Zero out the immutable slots (owner/maxSupply/... embedded by the
// constructor) so recompiled runtime code compares equal to on-chain code.
function maskImmutables(runtimeHex, immutableReferences) {
  const chars = runtimeHex.split("")
  for (const refs of Object.values(immutableReferences || {})) {
    for (const { start, length } of refs) {
      for (let i = start * 2; i < (start + length) * 2; i++) chars[i] = "0"
    }
  }
  return chars.join("")
}

async function main() {
  console.log(`🔍 Verifying contracts on Basescan — ${NETWORK} (chainid ${CHAINID})`)
  console.log(`   Receipt: ${Object.keys(receipt.contracts).length} contracts, deployer ${DEPLOYER}`)
  if (!API_KEY && !DRY_RUN) throw new Error("ETHERSCAN_API_KEY required (or set DRY_RUN=1)")

  // ── Recompile with the exact deployment input (plus runtime output for
  //    the local pre-flight; outputSelection does not affect codegen) ──
  const input = buildCompileInput()
  const checkInput = structuredClone(input)
  for (const key of Object.keys(checkInput.settings.outputSelection)) {
    checkInput.settings.outputSelection[key]["*"].push("evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences")
  }
  console.log("\n⚙️  Recompiling with the deployment standard-json input...")
  const output = JSON.parse(solc.compile(JSON.stringify(checkInput)))
  const errors = (output.errors || []).filter((e) => e.severity === "error")
  if (errors.length) throw new Error("recompilation failed: " + errors[0].message)
  const compilerVersion = etherscanCompilerVersion(solc.version())
  console.log(`   solc ${compilerVersion}, optimizer on, 200 runs`)

  const results = []
  for (const [name, address] of Object.entries(receipt.contracts)) {
    console.log(`\n📦 ${name} @ ${address}`)
    const file = output.contracts[`contracts/src/${name}.sol`]?.[name]
    if (!file) throw new Error(`${name}: missing from compiler output`)

    // ── Pre-flight: masked runtime bytecode must equal on-chain code ──
    const localRuntime = file.evm.deployedBytecode.object
    const onChain = (await pc.getCode({ address })).slice(2)
    const masked = maskImmutables(onChain, file.evm.deployedBytecode.immutableReferences)
    if (masked !== localRuntime) {
      throw new Error(
        `${name}: on-chain bytecode differs from local recompilation — verification would fail. ` +
          `Compiler/OZ version drift?`
      )
    }
    console.log("   ✓ runtime bytecode matches recompilation (immutables masked)")

    if (DRY_RUN) {
      console.log("   ⏭️  DRY_RUN — skipping API submission")
      results.push({ name, address, status: "dry-run" })
      continue
    }

    // ── ABI-encode constructor args from the artifact ABI ──
    const ctor = file.abi.find((a) => a.type === "constructor")
    let ctorArgsHex = ""
    if (ctor && ctor.inputs?.length) {
      const types = ctor.inputs.map((i) => i.type).join(",")
      ctorArgsHex = encodeAbiParameters(parseAbiParameters(types), argSpec[name](DEPLOYER)).slice(2)
    }

    // ── Submit verifysourcecode (standard-json) via Etherscan V2 ──
    // (chainid must be a URL query param — V2 ignores it in the form body)
    const body = new URLSearchParams({
      module: "contract",
      action: "verifysourcecode",
      apikey: API_KEY,
      codeFormat: "solidity-standard-json-input",
      sourceCode: JSON.stringify(input),
      contractaddress: address,
      // Standard-json requires "sourcefile.sol:ContractName" — the file part
      // must match the source unit key in the submitted JSON.
      contractname: `contracts/src/${name}.sol:${name}`,
      compilerversion: compilerVersion,
      constructorArguements: ctorArgsHex, // (sic) Etherscan's parameter name
      optimizationUsed: "1",
      runs: "200",
      licenseType: "2", // MIT — SPDX identifier in every source file
    })
    const submit = await (
      await fetch(`https://api.etherscan.io/v2/api?chainid=${CHAINID}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      })
    ).json()
    if (submit.status !== "1") throw new Error(`${name}: submit failed — ${submit.result}`)
    console.log(`   ↗ submitted (guid ${submit.result}), polling status...`)

    // ── Poll checkverifystatus ──
    let status = "Pending"
    for (let i = 0; i < 12 && status === "Pending"; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const check = await (
        await fetch(
          `https://api.etherscan.io/v2/api?chainid=${CHAINID}&module=contract&action=checkverifystatus&guid=${submit.result}&apikey=${API_KEY}`
        )
      ).json()
      status = String(check.result)
    }
    if (status === "Pass - Verified" || status.startsWith("Already Verified")) {
      console.log(`   ✅ verified — ${EXPLORER}/address/${address}#code`)
      results.push({ name, address, status: "verified" })
    } else {
      console.error(`   ❌ NOT verified — ${status}`)
      results.push({ name, address, status })
    }
  }

  console.log("\n═══════════════════════════════════════")
  for (const r of results) console.log(`  ${r.status === "verified" ? "✅" : "⏭️ "} ${r.name.padEnd(12)} ${r.address}`)
  if (results.some((r) => r.status !== "verified" && r.status !== "dry-run")) process.exit(1)
}

main().catch((e) => {
  console.error("\n❌ Verification failed:", e?.message ?? e)
  if (e?.cause) console.error("   cause:", e.cause?.message ?? e.cause)
  if (e?.details) console.error("   details:", e.details)
  process.exit(1)
})
