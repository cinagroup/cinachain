/**
 * Strip null bytes from all JS files in the build output.
 *
 * Windows Node.js/webpack sometimes emits null bytes (\x00) in bundled JS,
 * which causes Cloudflare Pages to return HTTP 500 for those files.
 * This script removes all null bytes after the build completes.
 */
import { readdir, readFile, writeFile } from "fs/promises"
import { join, extname, resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, "..", "out")

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else if (extname(entry.name) === ".js") {
      files.push(full)
    }
  }
  return files
}

async function main() {
  const files = await walk(OUT_DIR)
  let stripped = 0

  for (const file of files) {
    const buf = await readFile(file)
    const str = buf.toString("utf8")
    if (str.includes("\x00")) {
      const clean = str.replace(/\x00/g, "")
      await writeFile(file, clean, "utf8")
      stripped++
    }
  }

  if (stripped > 0) {
    console.log(`✅ Stripped null bytes from ${stripped} JS files`)
  } else {
    console.log("✅ No null bytes found")
  }
}

main().catch((e) => {
  console.error("strip-nulls failed:", e.message)
  process.exit(0) // Don't fail the build
})
