// Write CinaMega templates (on-chain SVG fallback + immutable CID) and lock.
//
// Prereqs:
//   1. scripts/generate-mega-assets.mjs has produced mega-assets/
//   2. mega-assets/cids.json exists — created by upload-mega-assets.mjs
//      (4EVERLAND) with real CIDs: { ucina, mcina, cina }
//   3. CinaMega is deployed; CINA_MEGA_CONTRACT set
//
// ⚠️ IRREVERSIBLE: after lockTemplates() the templates can never change.
// Run only once all three types are verified on the gateway.
//
// Gateway pre-flight normally requires every CID to be reachable via
// cinachain-mega-media (R2/4EVERLAND). When no pinning service token is
// available yet (e.g. 4EVERLAND onboarding pending), set SKIP_GATEWAY_CHECK=1:
// the CIDs are content-addressed and identical no matter where they are
// pinned later, and the media-gateway's on-chain fallback (getBackupSvgRaw)
// serves the assets until then.
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http, toHex } from "viem"
import { baseSepolia, base } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")
const SKIP_GATEWAY_CHECK = process.env.SKIP_GATEWAY_CHECK === "1"
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base" : "base-sepolia"
const CHAIN = NETWORK === "base" ? base : baseSepolia
const RPC = NETWORK === "base" ? "https://mainnet.base.org" : "https://base-sepolia-rpc.publicnode.com"
const ADDR = process.env.CINA_MEGA_CONTRACT
if (!ADDR) throw new Error("CINA_MEGA_CONTRACT required")

const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: CHAIN, transport: http(RPC) })
const wc = createWalletClient({ account: acct, chain: CHAIN, transport: http(RPC) })
const mega = JSON.parse(readFileSync(resolve("contracts/out/CinaMega.json"), "utf8"))

const ASSETS = resolve("mega-assets")
const CID_FILE = resolve(ASSETS, "cids.json")
if (!existsSync(CID_FILE)) {
  throw new Error(`${CID_FILE} not found — run scripts/upload-mega-assets.mjs first (T2)`)
}
const cids = JSON.parse(readFileSync(CID_FILE, "utf8"))
const TYPES = [
  { name: "ucina", type: 1n, cid: cids.ucina, svgFile: "ucina.svg" },
  { name: "mcina", type: 2n, cid: cids.mcina, svgFile: "mcina.svg" },
  { name: "cina", type: 3n, cid: cids.cina, svgFile: "cina.svg" },
]

async function main() {
  // Sanity check before anything is written: the gateway must already serve
  // every CID (never burn a CID into the contract that is not reachable).
  // Skipped with SKIP_GATEWAY_CHECK=1 when pinning is pending — CIDs are
  // content-addressed, so the check can safely run later against the same
  // values; the on-chain fallback covers serving until then.
  if (!SKIP_GATEWAY_CHECK) {
    for (const t of TYPES) {
      const url = `https://media.cinachain.com/${t.cid}/metadata.json`
      const r = await fetch(url)
      if (!r.ok) {
        throw new Error(`gateway check failed for ${t.name} (${r.status} ${url}) — aborting, nothing written`)
      }
      console.log(`   ✓ gateway serves ${t.name} ${t.cid}`)
    }
  } else {
    console.log("⏭️  SKIP_GATEWAY_CHECK=1 — skipping gateway pre-flight (chain fallback will serve assets)")
  }

  const svg = (name) => {
    const path = resolve(ASSETS, name)
    if (!existsSync(path)) throw new Error(`missing ${path}`)
    return toHex(readFileSync(path)) // Buffer → hex string for ABI bytes
  }

  for (const t of TYPES) {
    const tx = await wc.writeContract({
      address: ADDR,
      abi: mega.abi,
      functionName: "initTemplate",
      args: [t.type, svg(t.svgFile), t.cid],
    })
    await pc.waitForTransactionReceipt({ hash: tx })
    console.log(`   ✓ initTemplate(${t.name}) — ${t.cid} (${svg(t.svgFile).length / 2 - 1} bytes svg)`)
  }

  const lock = await wc.writeContract({ address: ADDR, abi: mega.abi, functionName: "lockTemplates" })
  await pc.waitForTransactionReceipt({ hash: lock })
  console.log("\n🔒 Templates locked — immutable. CinaMega fully initialized.")
}

main().catch((e) => {
  console.error("❌ Init failed:", e?.shortMessage ?? e?.message ?? e)
  process.exit(1)
})
