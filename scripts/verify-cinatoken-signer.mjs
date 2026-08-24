#!/usr/bin/env node
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
    throw new Error("DEPLOY_PRIVATE_KEY is missing or malformed")
  }
  return normalized
}

export async function verifyCinaTokenSigner({ privateKey, receipt, client }) {
  const normalizedKey = normalizePrivateKey(privateKey)
  const signer = privateKeyToAccount(normalizedKey).address
  const declaredOwner = getAddress(receipt.deployer)
  if (signer !== declaredOwner) {
    throw new Error("DEPLOY_PRIVATE_KEY signer does not match the deployment receipt owner")
  }

  const chainId = await client.getChainId()
  if (chainId !== receipt.chainId) {
    throw new Error(`RPC chain ID ${chainId} does not match receipt chain ID ${receipt.chainId}`)
  }

  for (const contractName of ["CinaBadge", "CinaCredit"]) {
    const address = getAddress(receipt.contracts[contractName])
    const bytecode = await client.getBytecode({ address })
    if (!bytecode || bytecode === "0x") {
      throw new Error(`${contractName} has no deployed bytecode`)
    }
    const liveOwner = getAddress(
      await client.readContract({ address, abi: ownerAbi, functionName: "owner" }),
    )
    if (liveOwner !== signer) {
      throw new Error(`${contractName} owner does not match the DEPLOY_PRIVATE_KEY signer`)
    }
  }

  return { signer, chainId }
}

async function main() {
  const receipt = JSON.parse(
    readFileSync(join(root, "contracts/out/deployment.base-sepolia.json"), "utf8"),
  )
  const publicEnv = readFileSync(join(root, ".env.production"), "utf8")
  const rpcUrl =
    process.env.CINACHAIN_RPC_URL || readPublicEnvValue(publicEnv, "NEXT_PUBLIC_BASE_RPC")
  if (!rpcUrl) throw new Error("CINACHAIN_RPC_URL/NEXT_PUBLIC_BASE_RPC is missing")

  const client = createPublicClient({ transport: http(rpcUrl) })
  const result = await verifyCinaTokenSigner({
    privateKey: process.env.DEPLOY_PRIVATE_KEY,
    receipt,
    client,
  })
  console.log(`Verified CinaToken signer ${result.signer} on chain ${result.chainId}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
