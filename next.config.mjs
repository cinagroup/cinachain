import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.cinachain.com" },
      { protocol: "https", hostname: "cdn.cinachain.com" },
      { protocol: "https", hostname: "meta.cinachain.com" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  env: {
    mode: process.env.NODE_ENV,
  },
  typescript: {
    // Upstream bug: `ox` (viem transitive dep) ships a .ts file
    // (tempo/KeyAuthorization.ts) with a type error that we cannot fix.
    // All app-level type errors have been fixed. Re-enable once
    // https://github.com/wevm/ox is patched or viem updates its dep.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
