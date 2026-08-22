// Shared RPC transport for the deploy/verify pipelines.
//
// Ordered endpoint chain per network, wired through viem's `fallback`
// transport: a failed request automatically moves to the next endpoint.
//
// base-sepolia prefers the Alchemy-backed rpc-proxy Worker (the Alchemy key
// lives only inside the Worker as a secret — scripts never see it; the
// Worker itself falls back further to public endpoints). Public endpoints
// follow: sepolia.base.org has been rejecting GitHub-runner requests during
// verification runs, so publicnode (reliable from CI) sits ahead of it.
import { fallback, http } from "viem"

const RPC_CHAINS = {
  "base-sepolia": [
    "https://rpc-proxy.cinachain.com", // Alchemy via the self-hosted Worker
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
  ],
  // rpc-proxy is Base-Sepolia-only (hardcoded upstream in the Worker).
  "base-mainnet": ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
}

export function rpcUrls(network) {
  if (process.env.DEPLOY_RPC_URL) return [process.env.DEPLOY_RPC_URL]
  return RPC_CHAINS[network] ?? RPC_CHAINS["base-sepolia"]
}

export function rpcTransport(network) {
  const urls = rpcUrls(network)
  if (urls.length === 1) return http(urls[0], { retryCount: 5, retryDelay: 2000 })
  return fallback(
    urls.map((url) => http(url, { retryCount: 2, retryDelay: 1000 })),
    { retryCount: 2 }
  )
}
