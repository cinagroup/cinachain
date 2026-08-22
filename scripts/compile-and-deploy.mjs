/**
 * 编译 CinaChain 合约 — 预处理 import 路径后用 solc 编译
 * （标准 JSON 输入的构建逻辑在 scripts/lib/compile-input.mjs，与
 *  Basescan 验证共用 — 保证验证时重放的字节码与部署完全一致）
 */
import { writeFileSync, mkdirSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { ROOT, buildCompileInput } from "./lib/compile-input.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const solc = require("solc")

const OUT = resolve(ROOT, "contracts/out")
mkdirSync(OUT, { recursive: true })

const input = buildCompileInput()
const srcCount = Object.keys(input.sources).filter((k) => k.startsWith("contracts/src/")).length
console.log("📂 Compiling CinaChain contracts...\n")
console.log(`   ${srcCount} source files + ${Object.keys(input.sources).length - srcCount} OZ files`)

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
