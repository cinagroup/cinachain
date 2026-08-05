import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"

interface WhitelistResponse {
  eligible: boolean
  proof: string[] | null
  merkleRoot: string | null
  mintLimit: number
  phase?: "public" | "whitelist" | "error"
  message?: string
}

const FALLBACK_API_URL = "https://whitelist-api.cinachain.com"

/**
 * 查询地址是否在白名单中的 hook
 * - 自动回退到默认的 Workers API
 * - 5 分钟缓存避免重复请求
 * - 暴露 isError 供 UI 显示
 * @param address 用户钱包地址
 */
export function useWhitelist(address?: Address) {
  return useQuery({
    queryKey: ["whitelist", address?.toLowerCase()],
    queryFn: async (): Promise<WhitelistResponse> => {
      if (!address) throw new Error("No address provided")

      const apiBaseUrl =
        process.env.NEXT_PUBLIC_WHITELIST_API_URL || FALLBACK_API_URL

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      try {
        const res = await fetch(
          `${apiBaseUrl}/whitelist/${address}`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)

        if (!res.ok) {
          throw new Error(`Whitelist API returned ${res.status}`)
        }

        return (await res.json()) as WhitelistResponse
      } catch (err) {
        clearTimeout(timeout)
        // 网络错误时回退到"公共铸造"模式，而不是无限加载
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Whitelist API timed out")
        }
        throw err
      }
    },
    enabled: !!address,
    staleTime: 1000 * 60 * 5, // 5 分钟缓存
    refetchInterval: 1000 * 60, // 每 60s 轮询 — 阶段切换能传播到已打开的页面
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
  })
}
