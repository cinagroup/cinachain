// 静态参数生成器（用于静态导出）
// 由于无法在构建时查询合约，我们预生成前 N 个 ID

const MAX_TOKENS = 100 // 预生成的最大 Token ID 数量

export function generateStaticParams(route: string) {
  // 为 collection/[id] 路由生成参数
  if (route === "collection") {
    return Array.from({ length: MAX_TOKENS }, (_, i) => ({
      id: (i + 1).toString(),
    }))
  }

  return []
}
