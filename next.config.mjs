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
    // Type errors now fail the build (project is tsc-clean)
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { webpack }) => {
    config.externals = config.externals || []
    config.externals.push({
      "@x402/evm/upto/client": "commonjs @x402/evm/upto/client",
      "@x402/evm/exact/client": "commonjs @x402/evm/exact/client",
      "@x402/core/client": "commonjs @x402/core/client",
      "@x402/svm/exact/client": "commonjs @x402/svm/exact/client",
      "@x402/evm": "commonjs @x402/evm",
    })

    // Reown imports the @wagmi/connectors barrel to discover Base, Coinbase,
    // and Safe connectors. That barrel also exposes two optional connectors
    // CinaChain does not enable: the deprecated MetaMask SDK connector and
    // Tempo's Porto connector. Ignore only those optional dynamic imports so
    // they are not pulled into the browser or reported as missing modules;
    // injected/EIP-6963 and WalletConnect support remain unchanged.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(?:@metamask\/sdk|porto(?:\/internal)?)$/,
      })
    )

    // Ox's optional Tempo miner selects `node:worker_threads` through an
    // expression so the same module can run in browsers and Node. Webpack
    // cannot statically resolve that intentional Node-only branch. CinaChain
    // does not enable Tempo, so suppress only this exact upstream warning;
    // keep every other critical-dependency warning visible.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module:
          /[\\/]ox[\\/]_esm[\\/]tempo[\\/]internal[\\/]virtualMasterPool\.js$/,
        message: /the request of a dependency is an expression/i,
      },
    ]
    return config
  },
}

export default nextConfig
