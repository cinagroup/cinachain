import { useQuery } from "@tanstack/react-query"
import { Address } from "viem"

interface WhitelistResponse {
  eligible: boolean
  proof: string[] | null
  merkleRoot: string | null
  mintLimit: number
}

/**
 * 查询地址是否在白名单中的 hook
 * @param address 用户钱包地址
 */
export function useWhitelist(address?: Address) {
  return useQuery({
    queryKey: ["whitelist", address],
    queryFn: async () => {
      if (!address) return null
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_WHITELIST_API_URL || 
        "https://api.cinachain.com"
      
      const res = await fetch(`${apiBaseUrl}/whitelist/${address}`)
      if (!res.ok) {
        throw new Error("Failed to fetch whitelist data")
      }
      
      return res.json() as Promise<WhitelistResponse>
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 分钟缓存
  })
}
