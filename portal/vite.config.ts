import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Static export → Cloudflare Pages (cinachain-portal). Output to ./dist,
// which is what `wrangler pages deploy portal/dist` ships.
export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror the DApp's "@" → src alias so ported components keep their imports.
      "@": path.resolve(dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
})
