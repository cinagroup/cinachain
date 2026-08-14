// Service Worker for the statically exported CinaChain application.

const CACHE_NAME = "cinachain-v7"
const OFFLINE_URL = "/offline"
const PRECACHE_RESOURCES = [OFFLINE_URL, "/manifest.json", "/favicon.ico"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_RESOURCES.map((resource) => cache.add(resource))
        )
      )
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) => name.startsWith("cinachain-") && name !== CACHE_NAME
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  // Let the browser handle APIs and cross-origin services directly.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return
  }

  // Navigations always prefer the deployed version. Only the offline page is
  // cached, preventing an older HTML/RSC response from referencing removed
  // deployment chunks.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return (
          (await caches.match(OFFLINE_URL)) ||
          new Response("Offline", { status: 503 })
        )
      })
    )
    return
  }

  // Next.js build assets are content-hashed and therefore safe to cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached

        const response = await fetch(event.request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(event.request, response.clone())
        }
        return response
      })
    )
  }

  // RSC/prefetch payloads and branded assets remain network-managed so every
  // deployment is observed immediately.
})
