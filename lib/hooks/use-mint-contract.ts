import { useContractWrite, usePrepareContractWrite } from "wagmi"
import { parseEther } from "viem"

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT as `0x${string}`
const MINT_PRICE = parseEther("0.05") // 0.05 ETH per NFT

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
 * 支持白名单铸造和公开铸造
 */
export function useMintContract() {
  /**
   * 白名单铸造
   * @param proof Merkle proof
   * @param quantity 铸造数量
   */
  function useMintWhitelist(proof: string[], quantity: number) {
    const { config } = usePrepareContractWrite({
      address: CONTRACT_ADDRESS,
      abi: MINT_ABI,
      functionName: "mintWhitelist",
      args: [proof as `0x${string}`[], BigInt(quantity)],
    })

    return useContractWrite(config)
  }

  /**
   * 公开铸造
   * @param quantity 铸造数量
   */
  function useMintPublic(quantity: number) {
    const { config } = usePrepareContractWrite({
      address: CONTRACT_ADDRESS,
      abi: MINT_ABI,
      functionName: "mintPublic",
      args: [BigInt(quantity)],
      value: MINT_PRICE * BigInt(quantity),
    })

    return useContractWrite(config)
  }

  return {
    useMintWhitelist,
    useMintPublic,
  }
}
