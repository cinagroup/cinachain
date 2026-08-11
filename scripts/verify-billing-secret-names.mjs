import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  REQUIRED_BILLING_SECRETS,
  scrubBillingSecrets,
  wranglerInvocation,
} from "./provision-billing-secrets.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultConfig = resolve(root, "workers/billing/wrangler.toml")

export function buildSecretListArgs(config, wranglerEnvironment) {
  const args = ["secret", "list", "--config", config, "--format", "json"]
  if (wranglerEnvironment) args.push("--env", wranglerEnvironment)
  return args
}

export function verifyBillingSecretNames({
  environment = process.env,
  spawn = spawnSync,
  platform = process.platform,
  rootDirectory = root,
  config = defaultConfig,
  binaryExists = existsSync,
} = {}) {
  const { command, prefixArgs } = wranglerInvocation(
    rootDirectory,
    platform,
    binaryExists
  )
  const result = spawn(
    command,
    [
      ...prefixArgs,
      ...buildSecretListArgs(config, environment.WRANGLER_ENV),
    ],
    {
      cwd: rootDirectory,
      env: scrubBillingSecrets(environment),
      encoding: "utf8",
    }
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    const error = new Error("Wrangler failed while listing Billing secrets")
    error.exitCode = result.status ?? 1
    error.stderr = result.stderr
    throw error
  }

  const bindings = JSON.parse(result.stdout)
  const configured = new Set(bindings.map(({ name }) => name))
  return REQUIRED_BILLING_SECRETS.filter((name) => !configured.has(name))
}

function main() {
  try {
    const missing = verifyBillingSecretNames()
    if (missing.length > 0) {
      console.error(
        `Missing required Cloudflare secret bindings: ${missing.join(", ")}`
      )
      process.exitCode = 1
      return
    }

    console.log(
      `Required Cloudflare secret bindings are configured: ${REQUIRED_BILLING_SECRETS.join(
        ", "
      )}.`
    )
  } catch (error) {
    if (error?.stderr) process.stderr.write(error.stderr)
    else console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = Number(error?.exitCode ?? 1)
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
