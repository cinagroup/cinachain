// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CinaBatch (ERC-1155) — ABI matching deployed CinaBadge contract
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export { CINA_ERC1155_CONTRACT, hasErc1155Contract } from "@/lib/contracts/addresses"

import { parseAbiItem } from "viem"

export const cinaErc1155Abi = [
  // Standard ERC-1155
  parseAbiItem("function balanceOf(address account, uint256 id) view returns (uint256)"),
  parseAbiItem("function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"),
  parseAbiItem("function uri(uint256 tokenId) view returns (string)"),

  // CinaBadge minting (owner-only)
  parseAbiItem("function mint(address to, uint256 tokenId, uint256 amount)"),
  parseAbiItem("function mintBatch(address[] recipients, uint256 tokenId, uint256 amountPerUser)"),
  parseAbiItem("function mintToAddress(address to, uint256[] tokenIds, uint256[] amounts)"),

  // CinaBadge views
  parseAbiItem("function getBadgeType(uint256 tokenId) view returns (tuple(string name, string description, bool soulbound, uint256 maxSupply, uint256 totalMinted, bool exists))"),
  parseAbiItem("function hasBadge(address account, uint256 tokenId) view returns (bool)"),

  // Admin
  parseAbiItem("function createBadgeType(string name, string description, bool soulbound, uint256 maxSupply) returns (uint256)"),
  parseAbiItem("function setURI(string newURI)"),
  parseAbiItem("function pause()"),
  parseAbiItem("function unpause()"),
] as const
