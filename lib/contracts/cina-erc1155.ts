// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CinaBatch (ERC-1155) — thin re-export of shared ABI + address
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
// NOTE: The getCinaERC1155Contract() factory has been removed.
// Use wagmi hooks (useReadContract, useWriteContract) with the
// ABI from this file.

export { CINA_ERC1155_CONTRACT, hasErc1155Contract } from "@/lib/contracts/addresses"

import { parseAbiItem } from "viem"

export const cinaErc1155Abi = [
  parseAbiItem(
    "function balanceOf(address account, uint256 id) view returns (uint256)"
  ),
  parseAbiItem(
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
  ),
  parseAbiItem("function uri(uint256 tokenId) view returns (string)"),
  parseAbiItem("function totalSupply(uint256 id) view returns (uint256)"),
  parseAbiItem(
    "function mintBatch(address to, uint256[] ids, uint256[] amounts, bytes data)"
  ),
  parseAbiItem("function mint(address to, uint256 id, uint256 amount, bytes data)"),
] as const
