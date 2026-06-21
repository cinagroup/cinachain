import { readContract, writeContract } from "@wagmi/core"
import { parseAbiItem } from "viem"

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`

const ABI = [
  // ERC1155 标准函数
  parseAbiItem("function balanceOf(address account, uint256 id) view returns (uint256)"),
  parseAbiItem("function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"),
  parseAbiItem("function uri(uint256 tokenId) view returns (string)"),
  parseAbiItem("function totalSupply(uint256 id) view returns (uint256)"),

  // 批量铸造函数
  parseAbiItem("function mintBatch(address to, uint256[] ids, uint256[] amounts, bytes data)"),
  parseAbiItem("function mint(address to, uint256 id, uint256 amount, bytes data)"),
] as const

export function getCinaERC1155Contract() {
  return {
    address: CONTRACT_ADDRESS,
    abi: ABI,
    read: {
      balanceOf: (args: [`0x${string}`, bigint]) =>
        readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "balanceOf",
          args,
        }),
      balanceOfBatch: (args: [`0x${string}`[], bigint[]]) =>
        readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "balanceOfBatch",
          args,
        }),
      uri: (args: [bigint]) =>
        readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "uri",
          args,
        }),
      totalSupply: (args: [bigint]) =>
        readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "totalSupply",
          args,
        }),
    },
    write: {
      mintBatch: (args: [`0x${string}`, bigint[], bigint[], `0x${string}`]) =>
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "mintBatch",
          args,
        }),
      mint: (args: [`0x${string}`, bigint, bigint, `0x${string}`]) =>
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "mint",
          args,
        }),
    },
  }
}
