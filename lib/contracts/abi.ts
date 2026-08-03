import { parseAbiItem } from "viem"

/**
 * Shared CinaNFT (ERC-721) ABI.
 * Import this instead of re-declaring inline ABIs in every page.
 */
export const CINA_NFT_ABI = [
  // Standard ERC-721
  parseAbiItem("function name() view returns (string)"),
  parseAbiItem("function symbol() view returns (string)"),
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem("function ownerOf(uint256 tokenId) view returns (address)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),

  // ERC-721 Enumerable (required for owner token listing)
  parseAbiItem(
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
  ),
  parseAbiItem("function tokenByIndex(uint256 index) view returns (uint256)"),

  // Minting
  parseAbiItem(
    "function mintPublic(uint256 quantity) payable"
  ),
  // Whitelist mint is FREE (nonpayable) — contract design decision
  parseAbiItem(
    "function mintWhitelist(bytes32[] proof, uint256 quantity)"
  ),

  // Config reads
  parseAbiItem("function mintPrice() view returns (uint256)"),
  parseAbiItem("function maxSupply() view returns (uint256)"),
  parseAbiItem("function paused() view returns (bool)"),
  parseAbiItem("function merkleRoot() view returns (bytes32)"),
  parseAbiItem("function baseURI() view returns (string)"),

  // Admin
  parseAbiItem("function pause()"),
  parseAbiItem("function unpause()"),
  parseAbiItem("function withdraw()"),
  parseAbiItem("function setMintPrice(uint256 price)"),
  parseAbiItem("function setBaseURI(string baseURI)"),
  parseAbiItem("function setMerkleRoot(bytes32 merkleRoot)"),

  // Transfer
  parseAbiItem(
    "function transferFrom(address from, address to, uint256 tokenId)"
  ),
  parseAbiItem(
    "function safeTransferFrom(address from, address to, uint256 tokenId)"
  ),
] as const
