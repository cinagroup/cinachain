// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CinaNFT (ERC-721) — thin re-export of shared ABI + address
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
//
// NOTE: The getCinaNftContract() factory and its hardcoded mainnet
// PublicClient have been removed. All pages now use wagmi hooks
// (useReadContract, useWriteContract) with the shared CINA_NFT_ABI
// and CINA_NFT_CONTRACT from lib/contracts/abi.ts + addresses.ts.
//
// This file is kept for backward compatibility of imports.

export { CINA_NFT_ABI } from "@/lib/contracts/abi"
export { CINA_NFT_CONTRACT, hasNftContract } from "@/lib/contracts/addresses"
