/**
 * 编译 CinaChain 合约 — 预处理 import 路径后用 solc 编译
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs"
import { resolve, dirname, join, relative } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const solc = require("solc")

const ROOT = resolve(__dirname, "..")
const SRC = resolve(ROOT, "contracts/src")
const OZ = resolve(ROOT, "contracts/openzeppelin")
const OUT = resolve(ROOT, "contracts/out")
mkdirSync(OUT, { recursive: true })

// Collect all .sol files (src + openzeppelin)
function collectSol(dir, base = dir) {
  const files = {}
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (entry.endsWith(".sol")) {
        let content = readFileSync(full, "utf8")
        // Rewrite @openzeppelin/contracts/X → relative path to openzeppelin/X
        content = content.replace(
          /from\s+["']@openzeppelin\/contracts\/([^"']+)["']/g,
          (match, p1) => {
            const target = resolve(OZ, p1)
            const rel = relative(dirname(full), target).replace(/\\/g, "/")
            return `from "${rel}"`
          }
        )
        const key = relative(ROOT, full).replace(/\\/g, "/")
        files[key] = { content }
      }
    }
  }
  walk(dir)
  return files
}

console.log("📂 Compiling CinaChain contracts...\n")

const srcFiles = collectSol(SRC)
const ozFiles = collectSol(OZ)
const sources = { ...srcFiles, ...ozFiles }
console.log(`   ${Object.keys(srcFiles).length} source files + ${Object.keys(ozFiles).length} OZ files`)

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
}

console.log("⚙️  Compiling...")
const output = JSON.parse(solc.compile(JSON.stringify(input)))

if (output.errors) {
  let hasError = false
  for (const e of output.errors) {
    if (e.severity === "error") hasError = true
    console.log(`   ${e.severity.toUpperCase()}: ${e.message?.split("\n")[0]}`)
  }
  if (hasError) {
    console.error("\n❌ Compilation failed!")
    process.exit(1)
  }
}

console.log("✅ Compiled!\n")

const artifacts = {}
for (const [fileKey, contracts] of Object.entries(output.contracts || {})) {
  for (const [name, contract] of Object.entries(contracts)) {
    if (fileKey.includes("src/")) {
      artifacts[name] = {
        abi: contract.abi,
        bytecode: "0x" + contract.evm.bytecode.object,
      }
      const sz = (contract.evm.bytecode.object.length / 2 / 1024).toFixed(1)
      console.log(`   📦 ${name}: ${sz} KB`)
    }
  }
}

for (const [name, art] of Object.entries(artifacts)) {
  writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(art, null, 2))
}
console.log(`\n💾 Saved to contracts/out/`)
