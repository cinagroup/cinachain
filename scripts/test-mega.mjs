// On-chain verification of CinaMega: unit math, free ucina mint + cap,
// bidirectional exchange with floor dust, revert guards, lock behavior.
// Usage: DEPLOY_PRIVATE_KEY=0x... CINA_MEGA_CONTRACT=0x... node scripts/test-mega.mjs
import { readFileSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")
// Base Sepolia public RPCs; MEGA_RPC_URL overrides (some public endpoints are
// flaky under burst reads — publicnode is generally the most stable).
const RPC = process.env.MEGA_RPC_URL ?? "https://base-sepolia-rpc.publicnode.com"
const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: baseSepolia, transport: http(RPC) })
const wc = createWalletClient({ account: acct, chain: baseSepolia, transport: http(RPC) })
const mega = JSON.parse(readFileSync(resolve("contracts/out/CinaMega.json"), "utf8"))
const ADDR = process.env.CINA_MEGA_CONTRACT
if (!ADDR) throw new Error("CINA_MEGA_CONTRACT required")

const f = (n, i = [], o = [], m = "view") => ({ name: n, type: "function", stateMutability: m, inputs: i, outputs: o })
const assert = (cond, msg) => { if (!cond) { console.error("❌ FAIL:", msg); process.exit(1) } console.log("✅", msg) }

const UCINA = 1n, MCINA = 2n, CINA = 3n
// Reads are pinned to the confirmed block of the previous write so a lagging
// RPC node can never return pre-transaction state (seen on Base Sepolia).
let readAt = undefined
const balOf = (t) =>
  pc.readContract({
    address: ADDR,
    abi: [f("balanceOf", [{ type: "address" }, { type: "uint256" }], [{ type: "uint256" }])],
    functionName: "balanceOf",
    args: [acct.address, t],
    blockNumber: readAt,
  })

async function mint(amount) {
  const tx = await wc.writeContract({ address: ADDR, abi: mega.abi, functionName: "mintUcina", args: [amount] })
  const rec = await pc.waitForTransactionReceipt({ hash: tx })
  readAt = rec.blockNumber
}

async function exch(from, to, amount) {
  const tx = await wc.writeContract({ address: ADDR, abi: mega.abi, functionName: "exchange", args: [from, to, amount] })
  const rec = await pc.waitForTransactionReceipt({ hash: tx })
  readAt = rec.blockNumber
}

async function main() {
  const cap = await pc.readContract({ address: ADDR, abi: [f("mintCapPerAddress", [], [{ type: "uint256" }])], functionName: "mintCapPerAddress" })
  assert(cap > 0n, `mintCapPerAddress = ${cap}`)

  // Unit math
  const units = (t) => pc.readContract({ address: ADDR, abi: [f("typeUnits", [{ type: "uint256" }], [{ type: "uint256" }])], functionName: "typeUnits", args: [t] })
  assert((await units(UCINA)) === 1n, "1 ucina = 1 unit")
  assert((await units(MCINA)) === 1000n, "1 mcina = 1000 units")
  assert((await units(CINA)) === 1000000n, "1 cina = 1,000,000 units")

  // Free mint
  await mint(1000000n)
  assert((await balOf(UCINA)) === 1000000n, "mint 1M ucina")

  // Mint cap revert
  const capUsed = await pc.readContract({ address: ADDR, abi: [f("ucinaMinted", [{ type: "address" }], [{ type: "uint256" }])], functionName: "ucinaMinted", args: [acct.address] })
  try {
    await pc.simulateContract({ address: ADDR, abi: mega.abi, functionName: "mintUcina", args: [cap - capUsed + 1n], account: acct.address })
    assert(false, "mint beyond cap should revert")
  } catch { assert(true, "mint beyond cap reverts (MintCapExceeded)") }

  // 1M ucina -> 1 cina
  await exch(UCINA, CINA, 1000000n)
  assert((await balOf(CINA)) === 1n, "1M ucina -> 1 cina")
  assert((await balOf(UCINA)) === 0n, "source ucina burned")

  // 1 cina -> 1000 mcina
  await exch(CINA, MCINA, 1n)
  assert((await balOf(MCINA)) === 1000n, "1 cina -> 1000 mcina")

  // 1000 mcina -> 1M ucina (round trip)
  await exch(MCINA, UCINA, 1000n)
  assert((await balOf(UCINA)) === 1000000n, "1000 mcina -> 1M ucina (round trip)")
  assert((await balOf(MCINA)) === 0n, "source mcina burned")

  // Dust: 1500 ucina -> mcina = 1 (500 units burned, floor).
  // Uses the 1M ucina left over from the round trip — the mint cap is
  // already exhausted, so no extra mint is needed here.
  await exch(UCINA, MCINA, 1500n)
  assert((await balOf(MCINA)) === 1n, "1500 ucina -> 1 mcina (dust 500 burned)")
  assert((await balOf(UCINA)) === 998500n, "dust-side ucina burned (1M - 1500)")

  // ExchangeTooSmall: 999 ucina -> cina = 0 → revert, nothing burned
  const before = await balOf(UCINA)
  try {
    await pc.simulateContract({ address: ADDR, abi: mega.abi, functionName: "exchange", args: [UCINA, CINA, 999n], account: acct.address })
    assert(false, "exchange yielding 0 should revert")
  } catch { assert(true, "exchange to 0 reverts (ExchangeTooSmall)") }
  assert((await balOf(UCINA)) === before, "nothing burned on ExchangeTooSmall revert")

  // SameTokenType + InvalidTokenType
  try {
    await pc.simulateContract({ address: ADDR, abi: mega.abi, functionName: "exchange", args: [UCINA, UCINA, 1n], account: acct.address })
    assert(false, "same-type exchange should revert")
  } catch { assert(true, "same-type exchange reverts") }
  try {
    await pc.simulateContract({ address: ADDR, abi: mega.abi, functionName: "exchange", args: [UCINA, 4n, 1n], account: acct.address })
    assert(false, "invalid type should revert")
  } catch { assert(true, "invalid type reverts") }

  // Lock behavior (if templates initialized)
  const locked = await pc.readContract({ address: ADDR, abi: [f("svgLocked", [], [{ type: "bool" }])], functionName: "svgLocked" })
  assert(typeof locked === "boolean", `svgLocked = ${locked}`)
  if (locked) {
    const uri = await pc.readContract({ address: ADDR, abi: [f("uri", [{ type: "uint256" }], [{ type: "string" }])], functionName: "uri", args: [UCINA] })
    assert(uri.startsWith("ipfs://"), `uri() = ${uri.slice(0, 40)}...`)
    const raw = await pc.readContract({ address: ADDR, abi: [f("getBackupSvgRaw", [{ type: "uint256" }], [{ type: "bytes" }])], functionName: "getBackupSvgRaw", args: [UCINA] })
    assert(raw.length > 0, `on-chain SVG fallback present (${raw.length} bytes)`)
    try {
      await pc.simulateContract({ address: ADDR, abi: mega.abi, functionName: "initTemplate", args: [UCINA, "0x00", "QmX"], account: acct.address })
      assert(false, "initTemplate after lock should revert")
    } catch { assert(true, "initTemplate after lock reverts") }
  } else {
    console.log("ℹ️  templates not initialized yet (run init-mega-templates.mjs after T2)")
  }

  console.log("\n🎉 CinaMega verified on-chain")
}

main().catch((e) => {
  console.error("❌ Test failed:", e?.shortMessage ?? e?.message ?? e)
  process.exit(1)
})
