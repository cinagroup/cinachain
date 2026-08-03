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
  webpack: (config) => {
    // Ignore optional peer deps from @base-org/account (x402 protocol).
    // These are only used for HTTP 402 payment flows which we don't use.
    config.externals = config.externals || []
    config.externals.push({
      "@x402/evm/upto/client": "commonjs @x402/evm/upto/client",
      "@x402/evm/exact/client": "commonjs @x402/evm/exact/client",
      "@x402/core/client": "commonjs @x402/core/client",
      "@x402/svm/exact/client": "commonjs @x402/svm/exact/client",
      "@x402/evm": "commonjs @x402/evm",
    })
    return config
  },
}

export default nextConfig
