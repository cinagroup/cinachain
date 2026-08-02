import { parseAbiItem } from "viem"
import { CINA_ERC1155_CONTRACT } from "@/lib/contracts/addresses"

const ABI = [
  // ERC1155 标准函数
  parseAbiItem(
    "function balanceOf(address account, uint256 id) view returns (uint256)"
  ),
  parseAbiItem(
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
  ),
  parseAbiItem("function uri(uint256 tokenId) view returns (string)"),
  parseAbiItem("function totalSupply(uint256 id) view returns (uint256)"),

  // 批量铸造函数
  parseAbiItem(
    "function mintBatch(address to, uint256[] ids, uint256[] amounts, bytes data)"
  ),
  parseAbiItem("function mint(address to, uint256 id, uint256 amount, bytes data)"),
] as const

export const cinaErc1155Abi = ABI
export const CINA_ERC1155_ADDRESS = CINA_ERC1155_CONTRACT

/**
 * ERC1155 合约元数据。
 * 注意：实际交易请使用 wagmi 的 `useReadContract` / `useWriteContract` hook
 *      （它们自动绑定 wagmi config），不要直接调用 @wagmi/core 的方法。
 */
export function getCinaERC1155Contract() {
  return {
    address: CINA_ERC1155_CONTRACT,
    abi: ABI,
  }
}
