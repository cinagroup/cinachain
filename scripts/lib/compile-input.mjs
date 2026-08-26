// Shared builder for the solc standard-json input used by BOTH the deploy
// pipeline (scripts/compile-and-deploy.mjs) and Basescan verification
// (scripts/verify-contracts.mjs). Verification must replay the exact same
// compilation (same source keys, same import rewriting, same settings) or
// the metadata hash embedded in the bytecode will differ and verification
// will fail — so the logic lives here, once.
import { readFileSync, readdirSync, statSync } from "fs"
import { resolve, dirname, join, relative } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
// scripts/lib/ → repo root
export const ROOT = resolve(__dirname, "..", "..")

export function buildCompileInput({ includeOz = true } = {}) {
  const SRC = resolve(ROOT, "contracts/src")
  const OZ = resolve(ROOT, "node_modules/@openzeppelin/contracts")

  // Collect all .sol files (src + openzeppelin from the npm dependency)
  function collectSol(dir) {
    const files = {}
    function walk(d) {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry)
        const st = statSync(full)
        if (st.isDirectory()) walk(full)
        else if (entry.endsWith(".sol")) {
          // Normalize CRLF → LF: local checkouts on Windows (autocrlf) must
          // compile to the same source hashes — and therefore the same
          // metadata/bytecode — as the Linux CI that deploys and verifies.
          let content = readFileSync(full, "utf8").replace(/\r\n/g, "\n")
          // Rewrite @openzeppelin/contracts/X → relative path to node_modules OZ
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

  const srcFiles = collectSol(SRC)
  const ozFiles = includeOz ? collectSol(OZ) : {}
  return {
    language: "Solidity",
    sources: { ...srcFiles, ...ozFiles },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Only codegen OUR contracts (matches scripts/compile-and-deploy.mjs).
      outputSelection: {
        "contracts/src/CinaNFT.sol": { "*": ["abi", "evm.bytecode.object"] },
        "contracts/src/CinaBadge.sol": { "*": ["abi", "evm.bytecode.object"] },
        "contracts/src/CinaCredit.sol": { "*": ["abi", "evm.bytecode.object"] },
        "contracts/src/CinaMega.sol": { "*": ["abi", "evm.bytecode.object"] },
        "contracts/src/CinaCreditV2.sol": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  }
}

// Etherscan compilerversion format, e.g. "0.8.36+commit.8a079791.Emscripten.clang"
// → "v0.8.36+commit.8a079791"
export function etherscanCompilerVersion(solcSemver) {
  return "v" + solcSemver.split(".Emscripten")[0]
}
