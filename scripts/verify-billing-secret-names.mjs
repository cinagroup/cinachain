import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  BILLING_SECRET_BINDINGS,
  BILLING_SECRET_SCOPE,
  BILLING_SECRETS_STORE_ID,
  listSecretsStoreMetadata,
  scrubBillingSecrets,
  wranglerInvocation,
} from "./provision-billing-secrets.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export function findBillingSecretsStoreIssues(metadata) {
  const secretsByName = new Map(metadata.map((secret) => [secret.name, secret]))
  const issues = []

  for (const { binding, secretName } of BILLING_SECRET_BINDINGS) {
    const secret = secretsByName.get(secretName)
    if (!secret) {
      issues.push({ binding, secretName, reason: "missing" })
      continue
    }
    if (secret.status !== "active") {
      issues.push({
        binding,
        secretName,
        reason: `status is ${secret.status || "unknown"}; expected active`,
      })
    }
    if (!secret.scopes.includes(BILLING_SECRET_SCOPE)) {
      issues.push({
        binding,
        secretName,
        reason: `scope ${BILLING_SECRET_SCOPE} is missing`,
      })
    }
  }

  return issues
}

export function verifyBillingSecretNames({
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
  const metadata = listSecretsStoreMetadata({
    spawn,
    command,
    prefixArgs,
    rootDirectory,
    environment: scrubBillingSecrets(environment),
  })
  return findBillingSecretsStoreIssues(metadata)
}

function main() {
  try {
    const issues = verifyBillingSecretNames()
    if (issues.length > 0) {
      console.error(
        `Billing Secrets Store verification failed for ${BILLING_SECRETS_STORE_ID}:`
      )
      for (const { binding, secretName, reason } of issues) {
        console.error(`- ${binding} -> ${secretName}: ${reason}`)
      }
      process.exitCode = 1
      return
    }

    console.log(
      `Billing Secrets Store entries are active with ${BILLING_SECRET_SCOPE} scope: ${BILLING_SECRET_BINDINGS.map(
        ({ binding, secretName }) => `${binding} -> ${secretName}`
      ).join(", ")}.`
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
