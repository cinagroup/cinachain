import { CdpClient } from "@coinbase/cdp-sdk"
import { createPublicClient, http, parseEther, formatEther } from "viem"
import { baseSepolia } from "viem/chains"

async function main() {
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
  })

  const pc = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") })
  const TARGET = "0xa1fBED1846E1fA0d7c1D44f60195F2Fc3dC23060"

  console.log("1. Creating CDP wallet...")
  const account = await cdp.evm.createAccount()
  console.log("   Address:", account.address)

  console.log("2. Requesting faucet...")
  const { transactionHash: fHash } = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth",
  })
  console.log("   Faucet TX:", fHash)
  await pc.waitForTransactionReceipt({ hash: fHash })
  console.log("3. Waiting balance sync (5s)...")
  await new Promise((r) => setTimeout(r, 5000))

  const bal = await pc.getBalance({ address: account.address })
  console.log("   Balance:", formatEther(bal), "ETH")

  console.log("4. Transferring to deploy address:", TARGET)
  const sendAmount = bal - parseEther("0.00003")
  console.log("   Sending:", formatEther(sendAmount), "ETH")

  const { transactionHash: tHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",
    transaction: {
      to: TARGET,
      value: sendAmount,
    },
  })
  console.log("   Transfer TX:", tHash)
  await pc.waitForTransactionReceipt({ hash: tHash })

  const targetBal = await pc.getBalance({ address: TARGET as `0x${string}` })
  console.log("5. Deploy address balance:", formatEther(targetBal), "ETH")
  console.log("   ✅ Ready to deploy!")
}

main().catch((e) => {
  console.error("❌", e.message)
  process.exit(1)
})
