import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    // Iron session requires a secret of at least 32 characters
    NEXTAUTH_SECRET: z
      .string()
      .min(32)
      .default("default_secret_for_build_at_least_32_characters_long"),
    DATABASE_URL: z.string().url().optional(),
    APP_ADMINS: z
      .string()
      .regex(/^(0x[a-fA-F0-9]{40}( *, *0x[a-fA-F0-9]{40})* *)*$/)
      .optional(),
    CF_RPC_SERVICE_AUTH_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_USE_PUBLIC_PROVIDER: z.enum(["true", "false"]).default("true"),
    NEXT_PUBLIC_PROD_NETWORKS_DEV: z.enum(["true", "false"]).default("false"),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_WC_PROJECT_ID: z.string().default("placeholder"),
    NEXT_PUBLIC_CF_IPFS_GATEWAY: z.string().url().optional(),
    NEXT_PUBLIC_CF_RPC_ENDPOINT: z.string().url().optional(),
    NEXT_PUBLIC_CINA_NFT_CONTRACT: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .default("0x0000000000000000000000000000000000000000"),
    NEXT_PUBLIC_APP_ADMINS: z.string().optional(),
  },
  runtimeEnv: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    APP_ADMINS: process.env.APP_ADMINS,
    CF_RPC_SERVICE_AUTH_TOKEN: process.env.CF_RPC_SERVICE_AUTH_TOKEN,
    NEXT_PUBLIC_USE_PUBLIC_PROVIDER: process.env.NEXT_PUBLIC_USE_PUBLIC_PROVIDER,
    NEXT_PUBLIC_PROD_NETWORKS_DEV: process.env.NEXT_PUBLIC_PROD_NETWORKS_DEV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_WC_PROJECT_ID: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
    NEXT_PUBLIC_CF_IPFS_GATEWAY: process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY,
    NEXT_PUBLIC_CF_RPC_ENDPOINT: process.env.NEXT_PUBLIC_CF_RPC_ENDPOINT,
    NEXT_PUBLIC_CINA_NFT_CONTRACT: process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT,
    NEXT_PUBLIC_APP_ADMINS: process.env.NEXT_PUBLIC_APP_ADMINS,
  },
})
