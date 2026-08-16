import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    APP_ADMINS: z
      .string()
      .regex(/^(0x[a-fA-F0-9]{40}( *, *0x[a-fA-F0-9]{40})* *)*$/)
      .optional(),
    // Server-only RPC auth token — MUST NEVER be imported in client code.
    // Used only inside Cloudflare Worker proxies.
    CF_RPC_SERVICE_AUTH_TOKEN: z.string().optional(),
    CF_BASE_RPC_SERVICE_AUTH_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_USE_PUBLIC_PROVIDER: z.enum(["true", "false"]).default("true"),
    NEXT_PUBLIC_PROD_NETWORKS_DEV: z.enum(["true", "false"]).default("false"),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    // WalletConnect/Reown project id — required for the AppKit wallet layer
    // (EOA wallets + Reown embedded smart accounts). Get one at
    // https://cloud.reown.com. NEXT_PUBLIC_WC_PROJECT_ID is the deprecated
    // RainbowKit-era name and kept only for back-compat.
    NEXT_PUBLIC_REOWN_PROJECT_ID: z.string().default("placeholder"),
    NEXT_PUBLIC_WC_PROJECT_ID: z.string().default("placeholder"),
    NEXT_PUBLIC_CF_IPFS_GATEWAY: z.string().url().optional(),
    NEXT_PUBLIC_CF_CDN_GATEWAY: z.string().url().optional(),
    NEXT_PUBLIC_CF_META_GATEWAY: z.string().url().optional(),
    NEXT_PUBLIC_CF_RPC_ENDPOINT: z.string().url().optional(),
    // Base Sepolia RPC endpoint — the self-hosted rpc-proxy Worker
    // (https://base-rpc.cinachain.com). The Worker proxies Alchemy server-side,
    // so the Alchemy key never reaches the browser bundle. When unset, the DApp
    // falls back to the public Base Sepolia endpoints directly (local dev
    // without the Worker). See RPC.md and workers/rpc-proxy.
    NEXT_PUBLIC_BASE_RPC: z.string().url().optional(),
    // Contract addresses are PUBLIC by definition (on-chain).
    NEXT_PUBLIC_CINA_NFT_CONTRACT: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .default("0x0000000000000000000000000000000000000000"),
    NEXT_PUBLIC_CINA_ERC1155_CONTRACT: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .default("0x0000000000000000000000000000000000000000"),
    NEXT_PUBLIC_CINA_CREDIT_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    // CinaMega ERC-1155 mega-collection + exchange (ucina/mcina/cina)
    NEXT_PUBLIC_CINA_MEGA_CONTRACT: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .default("0x0000000000000000000000000000000000000000"),
    // Media gateway for CinaMega assets (R2 → 4EVERLAND → on-chain fallback)
    NEXT_PUBLIC_MEGA_MEDIA_URL: z.string().url().optional(),
    // Mint price displayed in the UI (read-only; the contract is authoritative)
    NEXT_PUBLIC_MINT_PRICE_ETH: z.string().default("0.05"),
    // Whitelist API (Cloudflare Worker)
    NEXT_PUBLIC_WHITELIST_API_URL: z.string().url().optional(),
    // Paymaster proxy URL for gasless minting (empty = disabled)
    NEXT_PUBLIC_PAYMASTER_PROXY_URL: z.string().optional(),
    NEXT_PUBLIC_APP_ADMINS: z.string().optional(),
    // CinaAuth OIDC single sign-on (accounts.cinaseek.ai). Register an
    // OAuth client in the developer console (redirect URI must be
    // https://<site>/auth/callback, exact match) and set its client id
    // here. Sign-in stays disabled while the client id is empty.
    // API_BASE_URL points browser OIDC calls (discovery/token/userinfo/
    // jwks) at the same-origin proxy worker (workers/auth-proxy); leave
    // empty to use <origin>/api/auth.
    NEXT_PUBLIC_CINAAUTH_ISSUER: z
      .string()
      .url()
      .default("https://auth.cinaseek.ai"),
    NEXT_PUBLIC_CINAAUTH_CLIENT_ID: z.string().default(""),
    NEXT_PUBLIC_CINAAUTH_API_BASE_URL: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_ADMINS: process.env.APP_ADMINS,
    CF_RPC_SERVICE_AUTH_TOKEN: process.env.CF_RPC_SERVICE_AUTH_TOKEN,
    CF_BASE_RPC_SERVICE_AUTH_TOKEN: process.env.CF_BASE_RPC_SERVICE_AUTH_TOKEN,
    NEXT_PUBLIC_USE_PUBLIC_PROVIDER: process.env.NEXT_PUBLIC_USE_PUBLIC_PROVIDER,
    NEXT_PUBLIC_PROD_NETWORKS_DEV: process.env.NEXT_PUBLIC_PROD_NETWORKS_DEV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_REOWN_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
    NEXT_PUBLIC_WC_PROJECT_ID: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
    NEXT_PUBLIC_CF_IPFS_GATEWAY: process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY,
    NEXT_PUBLIC_CF_CDN_GATEWAY: process.env.NEXT_PUBLIC_CF_CDN_GATEWAY,
    NEXT_PUBLIC_CF_META_GATEWAY: process.env.NEXT_PUBLIC_CF_META_GATEWAY,
    NEXT_PUBLIC_CF_RPC_ENDPOINT: process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT,
    NEXT_PUBLIC_BASE_RPC: process.env.NEXT_PUBLIC_BASE_RPC,
    NEXT_PUBLIC_CINA_NFT_CONTRACT: process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT,
    NEXT_PUBLIC_CINA_ERC1155_CONTRACT: process.env.NEXT_PUBLIC_CINA_ERC1155_CONTRACT,
    NEXT_PUBLIC_CINA_CREDIT_CONTRACT: process.env.NEXT_PUBLIC_CINA_CREDIT_CONTRACT,
    NEXT_PUBLIC_CINA_MEGA_CONTRACT: process.env.NEXT_PUBLIC_CINA_MEGA_CONTRACT,
    NEXT_PUBLIC_MEGA_MEDIA_URL: process.env.NEXT_PUBLIC_MEGA_MEDIA_URL,
    NEXT_PUBLIC_MINT_PRICE_ETH: process.env.NEXT_PUBLIC_MINT_PRICE_ETH,
    NEXT_PUBLIC_WHITELIST_API_URL: process.env.NEXT_PUBLIC_WHITELIST_API_URL,
    NEXT_PUBLIC_PAYMASTER_PROXY_URL: process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL,
    NEXT_PUBLIC_APP_ADMINS: process.env.NEXT_PUBLIC_APP_ADMINS,
    NEXT_PUBLIC_CINAAUTH_ISSUER: process.env.NEXT_PUBLIC_CINAAUTH_ISSUER,
    NEXT_PUBLIC_CINAAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_CINAAUTH_CLIENT_ID,
    NEXT_PUBLIC_CINAAUTH_API_BASE_URL:
      process.env.NEXT_PUBLIC_CINAAUTH_API_BASE_URL,
  },
})
