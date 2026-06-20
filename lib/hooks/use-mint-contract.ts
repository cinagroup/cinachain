import { useWriteContract, useReadContract } from "wagmi"
import { parseEther } from "viem"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`
const MINT_PRICE = parseEther("0.05")

const MINT_ABI = [
  {
    name: "mintWhitelist",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes32[]" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "mintPublic",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
] as const

/**
 * NFT 铸造合约交互 hook
 */
export function useMintContract() {
  const { writeContract: mintWhitelist, isPending: mintWhitelistLoading } =
    useWriteContract()

  const { writeContract: mintPublic, isPending: mintPublicLoading } =
    useWriteContract()

  const doMintWhitelist = (proof: string[], quantity: number) => {
    mintWhitelist({
      address: CONTRACT_ADDRESS,
      abi: MINT_ABI,
      functionName: "mintWhitelist",
      args: [proof as `0x${string}`[], BigInt(quantity)],
    })
  }

  const doMintPublic = (quantity: number) => {
    mintPublic({
      address: CONTRACT_ADDRESS,
      abi: MINT_ABI,
      functionName: "mintPublic",
      args: [BigInt(quantity)],
      value: MINT_PRICE * BigInt(quantity),
    })
  }

  return {
    mintWhitelist: doMintWhitelist,
    mintWhitelistLoading,
    mintPublic: doMintPublic,
    mintPublicLoading,
  }
}
