import { useReadContract } from "wagmi"
import type { Address } from "viem"
import { CINA_ERC1155_CONTRACT, hasErc1155Contract } from "@/lib/contracts/addresses"

// Standard badge IDs defined in the CinaBadge contract
export const BADGE_IDS = {
  EARLY_MINTER: 1n,
  WHITELIST_MEMBER: 2n,
  DIAMOND_HOLDER: 3n,
  EVENT_TICKET: 4n,
  VIP_MEMBER: 5n,
} as const

export const BADGE_INFO: Record<number, { name: string; description: string; icon: string }> = {
  1: { name: "Early Minter", description: "First 1000 minters", icon: "🚀" },
  2: { name: "Whitelist Member", description: "Verified whitelist participant", icon: "✅" },
  3: { name: "Diamond Holder", description: "Holds 5+ CinaChain NFTs", icon: "💎" },
  4: { name: "Event Ticket", description: "Special event access", icon: "🎫" },
  5: { name: "VIP Member", description: "Transferable VIP membership", icon: "👑" },
}

const BADGE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOfBatch",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "ids", type: "uint256[]" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "hasBadge",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getBadgeType",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "soulbound", type: "bool" },
          { name: "maxSupply", type: "uint256" },
          { name: "totalMinted", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const

/**
 * Check all standard badges for an address in a single multicall.
 * Returns a map of badgeId => balance.
 */
export function useUserBadges(address?: Address) {
  const standardIds = Object.values(BADGE_IDS)

  const { data, isLoading, isError } = useReadContract({
    address: CINA_ERC1155_CONTRACT,
    abi: BADGE_ABI,
    functionName: "balanceOfBatch",
    args: address
      ? [standardIds.map(() => address), standardIds]
      : undefined,
    query: {
      enabled: !!address && hasErc1155Contract,
    },
  })

  const badges = (data ?? []).map((balance, index) => {
    const badgeId = Number(standardIds[index])
    const info = BADGE_INFO[badgeId]
    return {
      id: badgeId,
      name: info?.name ?? `Badge #${badgeId}`,
      description: info?.description ?? "",
      icon: info?.icon ?? "🏅",
      balance: Number(balance),
      owned: balance > 0n,
    }
  })

  const ownedBadges = badges.filter((b) => b.owned)

  return {
    badges,
    ownedBadges,
    ownedCount: ownedBadges.length,
    isLoading,
    isError,
  }
}

/**
 * Get details about a specific badge type from the contract.
 */
export function useBadgeType(tokenId: bigint | number) {
  const { data, isLoading } = useReadContract({
    address: CINA_ERC1155_CONTRACT,
    abi: BADGE_ABI,
    functionName: "getBadgeType",
    args: [BigInt(tokenId)],
    query: { enabled: hasErc1155Contract },
  })

  return {
    data,
    isLoading,
    name: (data?.[0] as string) ?? "",
    description: (data?.[1] as string) ?? "",
    soulbound: data?.[2] ?? false,
    maxSupply: data?.[3] ?? 0n,
    totalMinted: data?.[4] ?? 0n,
    exists: data?.[5] ?? false,
  }
}
