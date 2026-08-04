// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Contract Addresses (single source of truth)
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// All contract addresses are PUBLIC by definition (they live on-chain).
// They are safe to expose in the client bundle.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

function resolveAddress(envVar: string | undefined): `0x${string}` {
  const val = envVar?.trim()
  if (!val) return ZERO_ADDRESS as `0x${string}`
  if (!/^0x[a-fA-F0-9]{40}$/.test(val)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[cinachain] Invalid contract address: "${val}". Falling back to zero address.`
      )
    }
    return ZERO_ADDRESS as `0x${string}`
  }
  return val as `0x${string}`
}

/** ERC-721 CinaNFT main contract address */
export const CINA_NFT_CONTRACT = resolveAddress(
  process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT
)

/** ERC-1155 CinaBatch contract address */
export const CINA_ERC1155_CONTRACT = resolveAddress(
  process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT
)

/** ERC-20 CinaCredit billing token address */
export const CINA_CREDIT_CONTRACT = resolveAddress(
  process.env.NEXT_PUBLIC_CINA_CREDIT_CONTRACT
)
export const hasCreditContract = CINA_CREDIT_CONTRACT !== ZERO_ADDRESS

/** True when the NFT contract address is set (not the zero placeholder) */
export const hasNftContract = CINA_NFT_CONTRACT !== ZERO_ADDRESS
export const hasErc1155Contract = CINA_ERC1155_CONTRACT !== ZERO_ADDRESS

/** Mint price per NFT in ETH (read from env to allow runtime override) */
export const MINT_PRICE_ETH = Number(
  process.env.NEXT_PUBLIC_MINT_PRICE_ETH ?? "0.05"
)
