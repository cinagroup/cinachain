import { useAccount } from "wagmi"
import { useEffect, useState } from "react"

/**
 * 检查当前钱包地址是否在管理员列表中
 */
export function useAdminCheck() {
  const { address } = useAccount()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!address) {
      setIsAdmin(false)
      setIsLoading(false)
      return
    }

    // 从环境变量获取管理员列表（逗号分隔的地址）
    const adminAddresses = process.env.NEXT_PUBLIC_APP_ADMINS?.split(",").map(
      (addr) => addr.toLowerCase().trim()
    ) || []

    const normalizedAddress = address.toLowerCase()
    const isAdminUser = adminAddresses.includes(normalizedAddress)
    
    setIsAdmin(isAdminUser)
    setIsLoading(false)
  }, [address])

  return { isAdmin, isLoading, address }
}
