// On-chain verification of CinaCredit: rate/fee minting, onlyOwner, zero-amount guard, paused state
import { readFileSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")
const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") })
const wc = createWalletClient({ account: acct, chain: baseSepolia, transport: http("https://sepolia.base.org") })
const credit = JSON.parse(readFileSync(resolve("contracts/out/CinaCredit.json"), "utf8"))
const ADDR = process.env.CINA_CREDIT_CONTRACT
if (!ADDR) throw new Error("CINA_CREDIT_CONTRACT required")

const f = (n, i = [], o = [], m = "view") => ({ name: n, type: "function", stateMutability: m, inputs: i, outputs: o })
const assert = (cond, msg) => { if (!cond) { console.error("❌ FAIL:", msg); process.exit(1) } console.log("✅", msg) }

const RATE = 1000000n

// CinaCredit is an ERC-20 (18 decimals): balances/totals are 1e18-scaled
const WEI = 10n ** 18n
const toCredit = (v) => v / WEI

async function main() {
  const rate = await pc.readContract({ address: ADDR, abi: [f("ethToCreditRate", [], [{ type: "uint256" }])], functionName: "ethToCreditRate" })
  assert(rate === RATE, `rate = ${rate}`)
  const fee = await pc.readContract({ address: ADDR, abi: [f("platformFeeBps", [], [{ type: "uint256" }])], functionName: "platformFeeBps" })
  assert(fee === 200n, `fee = ${fee}`)
  const paused = await pc.readContract({ address: ADDR, abi: [f("paused", [], [{ type: "bool" }])], functionName: "paused" })
  assert(paused === false, "contract not paused")

  const balOf = (addr) => pc.readContract({ address: ADDR, abi: [f("balanceOf", [{ type: "address" }], [{ type: "uint256" }])], functionName: "balanceOf", args: [addr] })
  const before = await balOf(acct.address)
  const tx = await wc.writeContract({ address: ADDR, abi: credit.abi, functionName: "mintWithEth", value: parseEther("0.00005") })
  await pc.waitForTransactionReceipt({ hash: tx })
  const after = await balOf(acct.address)
  assert(toCredit(after - before) === 49n, `mint 0.00005 ETH -> +49 credit (got ${toCredit(after - before)} credit / ${after - before} raw)`)

  const tm = await pc.readContract({ address: ADDR, abi: [f("totalMintedOf", [{ type: "address" }], [{ type: "uint256" }])], functionName: "totalMintedOf", args: [acct.address] })
  assert(toCredit(tm) >= 49n, `totalMintedOf >= 49 (${toCredit(tm)} credit / ${tm} raw)`)

  try {
    await pc.simulateContract({ address: ADDR, abi: credit.abi, functionName: "mintTo", args: [acct.address, 1n], account: "0x3cA605BF725C64B3C5e38dbA21F25EBcFd1Fcf28" })
    assert(false, "mintTo from non-owner should revert")
  } catch { assert(true, "mintTo non-owner reverts") }

  // zero-amount mintTo must revert (prevents noise events for the indexer)
  try {
    await pc.simulateContract({ address: ADDR, abi: credit.abi, functionName: "mintTo", args: [acct.address, 0n], account: acct.address })
    assert(false, "mintTo with 0 amount should revert")
  } catch { assert(true, "mintTo zero-amount reverts") }

  const tx2 = await wc.writeContract({ address: ADDR, abi: credit.abi, functionName: "mintTo", args: [acct.address, 100n * WEI] })
  await pc.waitForTransactionReceipt({ hash: tx2 })
  const after2 = await balOf(acct.address)
  assert(toCredit(after2 - after) === 100n, `mintTo owner +100 (got ${toCredit(after2 - after)} credit / ${after2 - after} raw)`)

  console.log("\n🎉 CinaCredit verified on-chain")
}

main().catch((e) => { console.error("ERR:", e.message.slice(0, 200)); process.exit(1) })
