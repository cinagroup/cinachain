import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Legacy dashboard-sibling paths → dashboard sub-paths (sidebar continuity)
  async redirects() {
    return [
      { source: "/credits", destination: "/dashboard/credits", permanent: false },
      { source: "/keys", destination: "/dashboard/keys", permanent: false },
    ]
  },
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
    // Type errors now fail the build (project is tsc-clean)
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config) => {
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
