// Drill/ops task: mint CinaCreditV2 to an address (the EOA-first minter —
// later the multisig/hot wallet path). Mirrors the chain-worker settlement
// mint so the circular-economy drill can run end-to-end from CI.
//
// Usage (env): DEPLOY_PRIVATE_KEY + CREDIT_MINT_TO + CREDIT_MINT_AMOUNT_ETH
//   CINACREDIT_V2_ADDRESS / receipt override the target contract.
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { baseSepolia, base } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { rpcTransport, rpcUrls } from "./lib/rpc.mjs"
import { requirePrivateKey } from "./lib/keys.mjs"

const PK = requirePrivateKey(process.env.DEPLOY_PRIVATE_KEY)
const NETWORK = process.env.DEPLOY_NETWORK === "base-mainnet" ? "base-mainnet" : "base-sepolia"
const CHAIN = NETWORK === "base-mainnet" ? base : baseSepolia

const TO = (process.env.CREDIT_MINT_TO ?? "").trim()
const AMOUNT = parseEther(process.env.CREDIT_MINT_AMOUNT_ETH || "1")
if (!/^0x[0-9a-fA-F]{40}$/.test(TO)) throw new Error("CREDIT_MINT_TO must be a 0x… address")

function resolveV2() {
  if (process.env.CINACREDIT_V2_ADDRESS) return process.env.CINACREDIT_V2_ADDRESS
  const receipt = resolve(`contracts/out/deployment.${NETWORK}.json`)
  if (existsSync(receipt)) {
    const j = JSON.parse(readFileSync(receipt, "utf8"))
    if (j.contracts?.CinaCreditV2) return j.contracts.CinaCreditV2
  }
  throw new Error("CinaCreditV2 address unknown — set CINACREDIT_V2_ADDRESS or restore the receipt artifact")
}

const acct = privateKeyToAccount(PK)
const wallet = createWalletClient({ account: acct, chain: CHAIN, transport: http(rpcUrls(NETWORK)[0]) })
const pc = createPublicClient({ chain: CHAIN, transport: rpcTransport(NETWORK) })

const art = JSON.parse(readFileSync(resolve("contracts/out/CinaCreditV2.json"), "utf8"))
const V2 = resolveV2()

const hash = await wallet.writeContract({
  address: V2,
  abi: art.abi,
  functionName: "mintTo",
  args: [TO, AMOUNT],
})
const receipt = await pc.waitForTransactionReceipt({ hash })
if (receipt.status === "reverted") throw new Error(`mintTo reverted (tx ${hash})`)
const balance = await pc.readContract({ address: V2, abi: art.abi, functionName: "balanceOf", args: [TO] })
console.log(`✅ minted ${AMOUNT.toString()} wei CINA-C to ${TO}`)
console.log(`   tx: ${CHAIN.blockExplorers?.default?.url}/tx/${hash}`)
console.log(`   recipient balance now: ${balance.toString()} wei`)
