import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const BILLING_SECRETS_STORE_ID = "346e2b4b86334bc29083c064116e91cf"
export const BILLING_SECRET_SCOPE = "workers"
export const BILLING_SECRET_BINDINGS = [
  {
    binding: "ADMIN_KEY",
    secretName: "CINACHAIN_BILLING_ADMIN_KEY_V1",
  },
  {
    binding: "INGRESS_ENC_KEY",
    secretName: "CINACHAIN_BILLING_INGRESS_ENC_KEY_V1",
  },
]
export const REQUIRED_BILLING_SECRETS = BILLING_SECRET_BINDINGS.map(
  ({ binding }) => binding
)

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g
const SECRETS_STORE_PAGE_SIZE = 100
const TABLE_SEPARATOR = "\u2502"
const EMPTY_STORE_MESSAGE = "List request returned no secrets"

export function validateBillingSecret(name, value) {
  if (!value) throw new Error(`${name} is not set in the process environment`)
  if (name === "ADMIN_KEY" && value.length < 32) {
    throw new Error("ADMIN_KEY must contain at least 32 characters")
  }
  if (name === "ADMIN_KEY" && /\s/.test(value)) {
    throw new Error("ADMIN_KEY must not contain whitespace")
  }
  if (name === "INGRESS_ENC_KEY" && !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(
      "INGRESS_ENC_KEY must be exactly 32 bytes encoded as hexadecimal"
    )
  }
  if (/^(.)\1+$/.test(value)) {
    throw new Error(`${name} must not be a repeated-character placeholder`)
  }
}

export function scrubBillingSecrets(environment) {
  const secretNames = new Set(
    REQUIRED_BILLING_SECRETS.map((name) => name.toUpperCase())
  )
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) => !secretNames.has(name.toUpperCase())
    )
  )
}

export function wranglerCommand(
  rootDirectory = root,
  platform = process.platform,
  binaryExists = existsSync
) {
  const binary = resolve(
    rootDirectory,
    "workers/billing/node_modules/.bin",
    platform === "win32" ? "wrangler.cmd" : "wrangler"
  )
  if (!binaryExists(binary)) {
    throw new Error(
      "The locked Billing Wrangler binary is missing. Run `npm --prefix workers/billing ci` first."
    )
  }
  return binary
}

export function wranglerInvocation(
  rootDirectory = root,
  platform = process.platform,
  binaryExists = existsSync
) {
  const launcher = wranglerCommand(rootDirectory, platform, binaryExists)
  if (platform !== "win32") return { command: launcher, prefixArgs: [] }

  const entrypoint = resolve(
    rootDirectory,
    "workers/billing/node_modules/wrangler/bin/wrangler.js"
  )
  if (!binaryExists(entrypoint)) {
    throw new Error(
      "The locked Billing Wrangler entrypoint is missing. Run `npm --prefix workers/billing ci` first."
    )
  }

  return { command: process.execPath, prefixArgs: [entrypoint] }
}

export function buildSecretsStoreListArgs(page = 1) {
  return [
    "secrets-store",
    "secret",
    "list",
    BILLING_SECRETS_STORE_ID,
    "--remote",
    "--page",
    String(page),
    "--per-page",
    String(SECRETS_STORE_PAGE_SIZE),
  ]
}

export function buildSecretCreateArgs(secretName) {
  return [
    "secrets-store",
    "secret",
    "create",
    BILLING_SECRETS_STORE_ID,
    "--name",
    secretName,
    "--scopes",
    BILLING_SECRET_SCOPE,
    "--remote",
  ]
}

export function parseSecretsStoreList(output) {
  const rows = []
  const normalized = String(output ?? "").replace(ANSI_PATTERN, "")

  for (const line of normalized.split(/\r?\n/)) {
    if (!line.includes(TABLE_SEPARATOR)) continue
    const columns = line
      .split(TABLE_SEPARATOR)
      .slice(1, -1)
      .map((column) => column.trim())
    const [name, id, _comment, scopes, status] = columns
    if (name === "Name" || !/^[0-9a-f]{32}$/i.test(id ?? "")) continue

    rows.push({
      name,
      id,
      scopes: String(scopes)
        .split(/[,\s]+/)
        .filter(Boolean),
      status: String(status).toLowerCase(),
    })
  }

  return rows
}

export function listSecretsStoreMetadata({
  spawn,
  command,
  prefixArgs,
  rootDirectory,
  environment,
}) {
  const secrets = []

  for (let page = 1; ; page += 1) {
    const result = spawn(
      command,
      [...prefixArgs, ...buildSecretsStoreListArgs(page)],
      {
        cwd: rootDirectory,
        env: environment,
        encoding: "utf8",
      }
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
      const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
      if (diagnostic.includes(EMPTY_STORE_MESSAGE)) break
      const error = new Error(
        "Wrangler failed while listing Billing Secrets Store metadata"
      )
      error.exitCode = result.status ?? 1
      error.stderr = result.stderr
      throw error
    }

    const pageSecrets = parseSecretsStoreList(result.stdout)
    secrets.push(...pageSecrets)
    if (pageSecrets.length < SECRETS_STORE_PAGE_SIZE) break
  }

  return secrets
}

export function provisionBillingSecrets({
  environment = process.env,
  spawn = spawnSync,
  platform = process.platform,
  rootDirectory = root,
  binaryExists = existsSync,
} = {}) {
  const { command, prefixArgs } = wranglerInvocation(
    rootDirectory,
    platform,
    binaryExists
  )
  const childEnvironment = scrubBillingSecrets(environment)
  const metadata = listSecretsStoreMetadata({
    spawn,
    command,
    prefixArgs,
    rootDirectory,
    environment: childEnvironment,
  })
  const secretsByName = new Map(metadata.map((secret) => [secret.name, secret]))
  const existingBindings = BILLING_SECRET_BINDINGS.filter(({ secretName }) =>
    secretsByName.has(secretName)
  )

  const invalidExisting = existingBindings.filter(({ secretName }) => {
    const secret = secretsByName.get(secretName)
    return (
      secret.status !== "active" ||
      !secret.scopes.includes(BILLING_SECRET_SCOPE)
    )
  })
  if (invalidExisting.length > 0) {
    throw new Error(
      `Existing immutable Billing secret versions are not active with ${BILLING_SECRET_SCOPE} scope: ${invalidExisting
        .map(({ binding, secretName }) => `${binding} -> ${secretName}`)
        .join(
          ", "
        )}. Fix their metadata or introduce a new versioned secret name; this tool will not mutate an existing version.`
    )
  }

  const missingBindings = BILLING_SECRET_BINDINGS.filter(
    ({ secretName }) => !secretsByName.has(secretName)
  )
  const values = Object.fromEntries(
    missingBindings.map(({ binding }) => [binding, environment[binding]])
  )
  for (const { binding } of missingBindings) {
    validateBillingSecret(binding, values[binding])
  }

  for (const { binding, secretName } of missingBindings) {
    const result = spawn(
      command,
      [...prefixArgs, ...buildSecretCreateArgs(secretName)],
      {
        cwd: rootDirectory,
        env: childEnvironment,
        input: `${values[binding]}\n`,
        stdio: ["pipe", "inherit", "inherit"],
      }
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
      const error = new Error(
        `Wrangler failed while creating ${secretName} for ${binding}`
      )
      error.exitCode = result.status ?? 1
      throw error
    }
  }

  return {
    created: missingBindings.map(({ secretName }) => secretName),
    skipped: existingBindings.map(({ secretName }) => secretName),
  }
}

function main() {
  try {
    const { created, skipped } = provisionBillingSecrets()
    if (created.length > 0) {
      console.log(
        `Created immutable Billing Secrets Store versions with workers scope: ${created.join(
          ", "
        )}. Values were passed only through stdin.`
      )
    }
    if (skipped.length > 0) {
      console.log(
        `Skipped existing active immutable secret versions: ${skipped.join(
          ", "
        )}. Rotate by introducing a new versioned secret name, never by overwriting V1.`
      )
    }
  } catch (error) {
    if (error?.stderr) process.stderr.write(error.stderr)
    else console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = Number(error?.exitCode ?? 1)
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
