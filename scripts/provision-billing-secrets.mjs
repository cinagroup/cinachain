import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultConfig = resolve(root, "workers/billing/wrangler.toml")

export const REQUIRED_BILLING_SECRETS = ["ADMIN_KEY", "INGRESS_ENC_KEY"]

export function validateBillingSecret(name, value) {
  if (!value) throw new Error(`${name} is not set in the process environment`)
  if (name === "ADMIN_KEY" && value.length < 32) {
    throw new Error("ADMIN_KEY must contain at least 32 characters")
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

export function buildSecretPutArgs(name, config, wranglerEnvironment) {
  const args = ["secret", "put", name, "--config", config]
  if (wranglerEnvironment) args.push("--env", wranglerEnvironment)
  return args
}

export function provisionBillingSecrets({
  environment = process.env,
  spawn = spawnSync,
  platform = process.platform,
  rootDirectory = root,
  config = defaultConfig,
  binaryExists = existsSync,
} = {}) {
  const values = Object.fromEntries(
    REQUIRED_BILLING_SECRETS.map((name) => [name, environment[name]])
  )

  for (const name of REQUIRED_BILLING_SECRETS) {
    validateBillingSecret(name, values[name])
  }

  const { command, prefixArgs } = wranglerInvocation(
    rootDirectory,
    platform,
    binaryExists
  )
  const childEnvironment = scrubBillingSecrets(environment)
  for (const name of REQUIRED_BILLING_SECRETS) {
    const result = spawn(
      command,
      [
        ...prefixArgs,
        ...buildSecretPutArgs(name, config, environment.WRANGLER_ENV),
      ],
      {
        cwd: rootDirectory,
        env: childEnvironment,
        input: `${values[name]}\n`,
        stdio: ["pipe", "inherit", "inherit"],
      }
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
      const error = new Error(`Wrangler failed while provisioning ${name}`)
      error.exitCode = result.status ?? 1
      throw error
    }
  }
}

function main() {
  try {
    provisionBillingSecrets()
    console.log(
      "Billing secret bindings were provisioned without passing values as CLI arguments or child-process environment variables."
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = Number(error?.exitCode ?? 1)
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
