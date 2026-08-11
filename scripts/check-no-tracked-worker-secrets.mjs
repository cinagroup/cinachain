import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const secretNames = ["ADMIN_KEY", "INGRESS_ENC_KEY"]
const secretAlternation = secretNames.join("|")

const assignmentPatterns = [
  new RegExp(
    `^\\s*(?:export\\s+)?(?:\\$env:)?["']?(${secretAlternation})["']?\\s*=\\s*(.*?)\\s*$`,
    "gmi"
  ),
  new RegExp(
    `^\\s*(?:-\\s*)?["']?(${secretAlternation})["']?\\s*:\\s*(.*?)\\s*$`,
    "gmi"
  ),
  new RegExp(
    `(?:^|[{,])\\s*["'](${secretAlternation})["']\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^,}\\r\\n]+)`,
    "gmi"
  ),
]

const safePlaceholders = new Set([
  "***",
  "<redacted>",
  "<required-secret>",
  "<set-via-cloudflare-secret>",
  "<set-via-environment>",
  "<test-fixture>",
  "[redacted]",
  "null",
  "redacted",
  "undefined",
])

function stripTrailingComment(value) {
  let quote = null
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === "\\") {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index)
    }
  }

  return value
}

function normalizeAssignedValue(rawValue) {
  let value = stripTrailingComment(rawValue).trim()
  value = value.replace(/[,;]\s*$/, "").trim()

  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' || first === "'") && last === first) {
    value = value.slice(1, -1).trim()
  }

  return value
}

function isEnvironmentReference(value, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const references = [
    new RegExp(`^\\$${escapedName}$`, "i"),
    new RegExp(`^\\$\\{${escapedName}\\}$`, "i"),
    new RegExp(`^\\$env:${escapedName}$`, "i"),
    new RegExp(`^\\$\\{env:${escapedName}\\}$`, "i"),
    new RegExp(`^process\\.env\\.${escapedName}!?$`, "i"),
    new RegExp(`^process\\.env\\[["']${escapedName}["']\\]!?$`, "i"),
    new RegExp(`^\\$\\{\\{\\s*secrets\\.${escapedName}\\s*\\}\\}$`, "i"),
  ]

  return references.some((pattern) => pattern.test(value))
}

function isSafeAssignedValue(rawValue, name) {
  const value = normalizeAssignedValue(rawValue)
  if (value === "") return true
  if (safePlaceholders.has(value.toLowerCase())) return true
  return isEnvironmentReference(value, name)
}

function isPathScopedLegacyTestFixture(rawValue, name, path) {
  if (name !== "ADMIN_KEY") return false
  if (normalizeAssignedValue(rawValue).toLowerCase() !== "test-admin") {
    return false
  }

  const normalizedPath = path.replaceAll("\\", "/")
  return (
    /^workers\/billing\/src\/.*\.test\.[cm]?[jt]s$/i.test(normalizedPath) ||
    /^docs\/superpowers\/plans\/.*\.md$/i.test(normalizedPath)
  )
}

function lineNumberAt(source, index) {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === "\n") line += 1
  }
  return line
}

export function findPlaintextSecretAssignments(source, { path = "" } = {}) {
  const findings = []
  const seen = new Set()

  for (const pattern of assignmentPatterns) {
    pattern.lastIndex = 0
    for (const match of source.matchAll(pattern)) {
      const [, matchedName, rawValue] = match
      const name = matchedName.toUpperCase()
      if (
        isSafeAssignedValue(rawValue, name) ||
        isPathScopedLegacyTestFixture(rawValue, name, path)
      ) {
        continue
      }

      const line = lineNumberAt(source, match.index)
      const key = `${name}:${line}`
      if (seen.has(key)) continue
      seen.add(key)
      findings.push({ name, line })
    }
  }

  return findings.sort((left, right) => left.line - right.line)
}

export function listCurrentRepositoryFiles(rootDirectory, spawn = spawnSync) {
  const result = spawn(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: rootDirectory, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error("Unable to list current repository files with git ls-files")
  }

  return result.stdout.split("\0").filter(Boolean)
}

export async function scanCurrentRepository({
  rootDirectory = root,
  listFiles = listCurrentRepositoryFiles,
} = {}) {
  const findings = []
  const repositoryPrefix = `${resolve(rootDirectory)}${sep}`

  for (const relativePath of listFiles(rootDirectory)) {
    const path = resolve(rootDirectory, relativePath)
    if (!path.startsWith(repositoryPrefix)) continue

    let source
    try {
      source = await readFile(path, "utf8")
    } catch (error) {
      if (error?.code === "ENOENT") continue
      throw error
    }
    if (source.includes("\0")) continue

    const fileFindings = findPlaintextSecretAssignments(source, {
      path: relativePath,
    })
    for (const finding of fileFindings) {
      findings.push({ path: relativePath, ...finding })
    }
  }

  return findings
}

async function main() {
  const findings = await scanCurrentRepository()
  if (findings.length > 0) {
    console.error(
      "Plaintext Worker secret assignments were found in current repository files:"
    )
    findings.forEach(({ path, name, line }) =>
      console.error(`- ${path}:${line} (${name})`)
    )
    process.exitCode = 1
    return
  }

  console.log(
    "No plaintext Worker secret assignments were found in current repository files."
  )
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
