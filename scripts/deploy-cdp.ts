/**
 * 使用 CDP API Key Wallet 部署合约到 Base Sepolia
 */
import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { CdpClient } from "@coinbase/cdp-sdk"
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  parseEther,
  serializeTransaction,
  type Abi,
  type Address,
  type Hex,
} from "viem"
import { baseSepolia } from "viem/chains"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, "../contracts/out")

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET
const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET

if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET || !CDP_WALLET_SECRET) {
  console.error("❌ Missing CDP credentials!")
  process.exit(1)
}

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
})

interface ContractArtifact {
  abi: Abi
  bytecode: Hex
}

function loadArtifact(name: string): ContractArtifact {
  const value: unknown = JSON.parse(
    readFileSync(resolve(OUT, `${name}.json`), "utf8")
  )
  if (
    typeof value !== "object" ||
    value === null ||
    !("abi" in value) ||
    !Array.isArray(value.abi) ||
    !("bytecode" in value) ||
    typeof value.bytecode !== "string" ||
    !value.bytecode.startsWith("0x")
  ) {
    throw new Error(`Invalid contract artifact: ${name}`)
  }
  return value as ContractArtifact
}

async function deployContract(
  cdp: CdpClient,
  account: { address: Address },
  name: string,
  artifact: ContractArtifact,
  constructorArgs: readonly unknown[],
  gasLimit: bigint
) {
  console.log(`\n📦 Deploying ${name}...`)

  // Encode constructor args
  const constructor = artifact.abi.find((item) => item.type === "constructor")
  let data = artifact.bytecode

  if (constructor?.type === "constructor" && constructor.inputs.length > 0) {
    const encodedArgs = encodeAbiParameters(constructor.inputs, constructorArgs)
    data = (data + encodedArgs.slice(2)) as `0x${string}`
  }

  // Get nonce + gas prices for a well-formed EIP-1559 transaction
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  })
  const block = await publicClient.getBlock()
  const baseFee = block.baseFeePerGas ?? 100n
  const maxPriorityFeePerGas = 100_000n // 0.0001 gwei
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

  console.log(
    `   Nonce: ${nonce}, Gas limit: ${gasLimit}, Max fee: ${maxFeePerGas}`
  )

  // Build raw unsigned EIP-1559 transaction (no `to` = contract creation)
  // Serialize as RLP, then send as hex string to CDP
  const serialized = serializeTransaction({
    to: null, // contract creation
    data,
    gas: gasLimit,
    value: 0n,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId: baseSepolia.id,
    accessList: [],
  })

  console.log(`   RLP length: ${(serialized as string).length} chars`)

  const { transactionHash: rawTransactionHash } = await cdp.evm.sendTransaction(
    {
      address: account.address,
      network: "base-sepolia" as const,
      transaction: serialized as Hex,
    }
  )

  if (!rawTransactionHash || !/^0x[0-9a-f]{64}$/i.test(rawTransactionHash)) {
    throw new Error("CDP returned an invalid transaction hash")
  }
  const transactionHash = rawTransactionHash

  console.log(`   TX: https://sepolia.basescan.org/tx/${transactionHash}`)
  console.log("   ⏳ Waiting for confirmation...")

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  })

  if (receipt.status !== "success") {
    console.error(`   ❌ ${name} deployment reverted!`)
    console.error(`   Gas used: ${Number(receipt.gasUsed).toLocaleString()}`)
    process.exit(1)
  }

  if (!receipt.contractAddress) {
    throw new Error(
      `${name} deployment receipt did not include a contract address`
    )
  }

  console.log(`   ✅ ${name}: ${receipt.contractAddress}`)
  console.log(`   Gas used: ${Number(receipt.gasUsed).toLocaleString()}`)

  return receipt.contractAddress
}

async function main() {
  console.log("═══════════════════════════════════════════════")
  console.log("  CinaChain Deployment via CDP API Key Wallet")
  console.log("═══════════════════════════════════════════════")

  const cdp = new CdpClient({
    apiKeyId: CDP_API_KEY_ID!,
    apiKeySecret: CDP_API_KEY_SECRET!,
    walletSecret: CDP_WALLET_SECRET!,
  })

  // ─── Create wallet ───
  console.log("\n🔑 Creating CDP wallet...")
  const account = await cdp.evm.createAccount()
  console.log(`   Address: ${account.address}`)

  // ─── Faucet ───
  console.log("\n🚰 Requesting test ETH...")
  const { transactionHash: faucetHash } = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth",
  })
  console.log(`   Faucet TX: https://sepolia.basescan.org/tx/${faucetHash}`)
  console.log("   ⏳ Waiting...")
  await publicClient.waitForTransactionReceipt({ hash: faucetHash })
  await new Promise((r) => setTimeout(r, 5000))

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`   💰 Balance: ${Number(balance) / 1e18} ETH`)

  if (balance === 0n) {
    console.error("❌ No ETH from faucet. Try again later.")
    process.exit(1)
  }

  // ─── Deploy CinaNFT ───
  const nftArt = loadArtifact("CinaNFT")
  const nftAddress = await deployContract(
    cdp,
    account,
    "CinaNFT",
    nftArt,
    ["CinaChain NFT", "CINA", 10000n, parseEther("0.001"), account.address],
    5_000_000n // 5M gas limit (generous for contract deployment)
  )

  // ─── Deploy CinaBadge ───
  const badgeArt = loadArtifact("CinaBadge")
  const badgeAddress = await deployContract(
    cdp,
    account,
    "CinaBadge",
    badgeArt,
    ["ipfs://QmBadges/{id}.json", account.address],
    5_000_000n
  )

  // ─── Summary ───
  console.log("\n═══════════════════════════════════════════════")
  console.log("  ✅ Deployment Complete!")
  console.log("═══════════════════════════════════════════════")
  console.log(`\n📋 CinaNFT (ERC-721):    ${nftAddress}`)
  console.log(`   Explorer: https://sepolia.basescan.org/address/${nftAddress}`)
  console.log(`\n📋 CinaBadge (ERC-1155): ${badgeAddress}`)
  console.log(
    `   Explorer: https://sepolia.basescan.org/address/${badgeAddress}`
  )

  console.log("\n📝 Add to .env.local:")
  console.log(`NEXT_PUBLIC_CINA_NFT_CONTRACT=${nftAddress}`)
  console.log(`NEXT_PUBLIC_CINA_ERC1155_CONTRACT=${badgeAddress}`)

  console.log("\n🔄 Rebuild:")
  console.log(
    "npm run build && npx wrangler pages deploy out --project-name=cinachain-dapp-v2 --commit-dirty=true"
  )
}

main().catch((error: unknown) => {
  const err =
    error instanceof Error ? error : new Error("Unknown deployment error")
  console.error("\n❌ Deployment failed:", err.message?.split("\n")[0] || err)
  if (err.cause instanceof Error) console.error("   Cause:", err.cause.message)
  process.exit(1)
})
