import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.cinachain.com" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  env: {
    mode: process.env.NODE_ENV,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: /icon/,
      use: ["@svgr/webpack"],
    })
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: { not: [/icon/] },
      loader: "next-image-loader",
      options: { assetPrefix: "" },
    })
    return config
  },
}

// Cloudflare Pages 本地开发兼容
if (process.env.NODE_ENV === "development") {
  try {
    const { setupDevPlatform } = await import(
      "@cloudflare/next-on-pages/next-dev"
    )
    await setupDevPlatform()
  } catch {
    // @cloudflare/next-on-pages not installed, skip
  }
}

export default nextConfig
