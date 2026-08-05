// CinaMega ERC-1155 ABI + address (parseAbiItem style, mirrors cina-erc1155.ts).
import { parseAbiItem } from "viem"

import { CINA_MEGA_CONTRACT } from "./addresses"

export { CINA_MEGA_CONTRACT }

export const cinaMegaAbi = [
  // ── Views ──
  parseAbiItem("function balanceOf(address account, uint256 id) view returns (uint256)"),
  parseAbiItem("function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"),
  parseAbiItem("function uri(uint256 tokenType) view returns (string)"),
  parseAbiItem("function typeUnits(uint256 tokenType) pure returns (uint256)"),
  parseAbiItem("function typeRawSvg(uint256 tokenType) view returns (bytes)"),
  parseAbiItem("function typeCid(uint256 tokenType) view returns (string)"),
  parseAbiItem("function mintCapPerAddress() view returns (uint256)"),
  parseAbiItem("function ucinaMinted(address account) view returns (uint256)"),
  parseAbiItem("function svgLocked() view returns (bool)"),
  parseAbiItem("function paused() view returns (bool)"),
  // ── Public ──
  parseAbiItem("function mintUcina(uint256 amount)"),
  parseAbiItem("function exchange(uint256 fromType, uint256 toType, uint256 amount)"),
  // ── Admin ──
  parseAbiItem("function setMintCap(uint256 cap)"),
  parseAbiItem("function initTemplate(uint256 tokenType, bytes rawSvg, string cid)"),
  parseAbiItem("function lockTemplates()"),
] as const
