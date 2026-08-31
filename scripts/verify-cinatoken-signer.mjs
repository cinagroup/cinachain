import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createPublicClient, getAddress, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const ownerAbi = [
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
]
// CinaCreditV2 is AccessControl-based: mint authority is MINTER_ROLE, not owner().
const accessControlAbi = [
  {
    inputs: [],
    name: "MINTER_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "hasRole",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
]

export function readPublicEnvValue(text, name) {
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator <= 0 || line.slice(0, separator).trim() !== name) continue
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return ""
}

export function normalizePrivateKey(value) {
  const trimmed = String(value || "").trim()
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-f]{64}$/iu.test(normalized)) {
    throw new Error("CINATOKEN_MINTER_PRIVATE_KEY is missing or malformed")
  }
  return normalized
}

export async function verifyCinaTokenSigner({ privateKey, receipt, client }) {
  const normalizedKey = normalizePrivateKey(privateKey)
  const signer = privateKeyToAccount(normalizedKey).address
  const deployer = getAddress(receipt.deployer)
  if (signer === deployer) {
    throw new Error("CinaToken minter must not reuse the deployment signer")
  }

  const chainId = await client.getChainId()
  if (chainId !== receipt.chainId) {
    throw new Error(
      `RPC chain ID ${chainId} does not match receipt chain ID ${receipt.chainId}`
    )
  }

  const badgeAddress = getAddress(receipt.contracts.CinaBadge)
  const creditAddress = getAddress(receipt.contracts.CinaCredit)
  for (const [contractName, address] of [
    ["CinaBadge", badgeAddress],
    ["CinaCredit", creditAddress],
  ]) {
    const bytecode = await client.getBytecode({ address })
    if (!bytecode || bytecode === "0x") {
      throw new Error(`${contractName} has no deployed bytecode`)
    }
  }

  const badgeOwner = getAddress(
    await client.readContract({
      address: badgeAddress,
      abi: ownerAbi,
      functionName: "owner",
    })
  )
  if (badgeOwner !== signer) {
    throw new Error("CinaBadge owner does not match the dedicated signer")
  }

  const role = await client.readContract({
    address: creditAddress,
    abi: accessControlAbi,
    functionName: "MINTER_ROLE",
  })
  const granted = await client.readContract({
    address: creditAddress,
    abi: accessControlAbi,
    functionName: "hasRole",
    args: [role, signer],
  })
  if (!granted) {
    throw new Error("CinaCredit signer lacks MINTER_ROLE")
  }

  return { signer, chainId }
}

async function main() {
  const receipt = JSON.parse(
    readFileSync(join(root, "config/cinatoken-chain.base-sepolia.json"), "utf8")
  )
  const publicEnv = readFileSync(join(root, ".env.production"), "utf8")
  const rpcUrl =
    process.env.CINACHAIN_RPC_URL ||
    readPublicEnvValue(publicEnv, "NEXT_PUBLIC_BASE_RPC")
  if (!rpcUrl)
    throw new Error("CINACHAIN_RPC_URL/NEXT_PUBLIC_BASE_RPC is missing")

  const client = createPublicClient({ transport: http(rpcUrl) })
  const result = await verifyCinaTokenSigner({
    privateKey: process.env.CINATOKEN_MINTER_PRIVATE_KEY,
    receipt,
    client,
  })
  console.log(
    `Verified CinaToken signer ${result.signer} on chain ${result.chainId}`
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
