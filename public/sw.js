// Service Worker for CinaChain PWA
// 静态导出兼容方案

const CACHE_NAME = "cinachain-v1"
const OFFLINE_URL = "/offline"

// 需要缓存的静态资源
const PRECACHE_RESOURCES = [
  "/",
  "/explore",
  "/mint",
  "/mint-batch",
  "/dashboard",
  "/dashboard/account",
  "/dashboard/nfts",
  "/dashboard/favorites",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192x192.png",
  "/icon-512x512.png",
]

// 不缓存的域名和路径模式
const NO_CACHE_PATTERNS = [
  "rpc.cinachain.com",
  "ipfs.cinachain.com",
  "/api/",
  "eth.llamarpc.com",
  "mainnet.base.org",
  "rpc.sepolia.org",
]

// 安装事件：预缓存关键资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Precaching resources")
      return cache.addAll(PRECACHE_RESOURCES).catch(() => {
        // Ignore precache failures
        return null
      })
    })
  )
  self.skipWaiting()
})

// 激活事件：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("[Service Worker] Deleting old cache:", name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// 检查 URL 是否应该被缓存
function shouldCache(url) {
  try {
    const urlObj = new URL(url)
    return !NO_CACHE_PATTERNS.some((pattern) =>
      urlObj.hostname.includes(pattern) || urlObj.pathname.includes(pattern)
    )
  } catch {
    return false
  }
}

// Fetch 事件：智能缓存策略
self.addEventListener("fetch", (event) => {
  // POST 请求永不缓存
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  // RPC/API 请求：直接网络请求，不缓存
  if (!shouldCache(event.request.url)) return

  // 静态资源：缓存优先
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone).catch(() => {})
            })
          }
          return response
        }).catch(() => {
          // Return empty response on network failure
          return new Response("", { status: 408 })
        })
      })
    )
    return
  }

  // 页面请求：网络优先，失败时返回离线页面
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL).catch(() => {
          return new Response("Offline", { status: 503 })
        })
      })
    )
    return
  }

  // 其他 GET 请求：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {})
          })
        }
        return response
      }).catch(() => {
        return new Response("", { status: 408 })
      })
    })
  )
})
