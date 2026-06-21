// Service Worker for CinaChain PWA
// 静态导出兼容方案

const CACHE_NAME = "cinachain-v1"
const OFFLINE_URL = "/offline"

// 需要缓存的资源
const PRECACHE_RESOURCES = [
  "/",
  "/explore",
  "/mint",
  "/dashboard",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192x192.png",
  "/icon-512x512.png",
]

// IPFS 网关域名（需要缓存）
const IPFS_DOMAINS = [
  "ipfs.cinachain.com",
  "cloudflare-ipfs.com",
  "ipfs.io",
]

// 安装事件：预缓存关键资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Precaching resources")
      return cache.addAll(PRECACHE_RESOURCES)
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

// Fetch 事件：缓存优先策略
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // IPFS 资源：缓存优先
  if (IPFS_DOMAINS.some((domain) => url.hostname.includes(domain))) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response
        }
        return fetch(event.request).then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return fetchResponse
        })
      })
    )
    return
  }

  // 页面请求：网络优先，失败时返回离线页面
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL)
      })
    )
    return
  }

  // 其他资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).then((fetchResponse) => {
        if (fetchResponse && fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return fetchResponse
      })
    })
  )
})
