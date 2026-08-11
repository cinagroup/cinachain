import { describe, expect, it, vi } from "vitest"

import {
  findPlaintextSecretAssignments,
  listCurrentRepositoryFiles,
} from "../check-no-tracked-worker-secrets.mjs"
import {
  BILLING_SECRET_BINDINGS,
  BILLING_SECRET_SCOPE,
  BILLING_SECRETS_STORE_ID,
  parseSecretsStoreList,
  provisionBillingSecrets,
  REQUIRED_BILLING_SECRETS,
  wranglerInvocation,
} from "../provision-billing-secrets.mjs"
import {
  findBillingSecretsStoreIssues,
  verifyBillingSecretNames,
} from "../verify-billing-secret-names.mjs"

const adminName = ["ADMIN", "KEY"].join("_")
const ingressName = ["INGRESS", "ENC", "KEY"].join("_")
const literalValue = ["fixture", "plain", "value"].join("-")
const adminSecretId = "a".repeat(32)
const ingressSecretId = "b".repeat(32)

function validSecretEnvironment() {
  return {
    [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
    [ingressName]: "0123456789abcdef".repeat(4),
    CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
    CLOUDFLARE_ACCOUNT_ID: "fixture-account-id",
    PATH: "fixture-path",
  }
}

function secretsStoreTable(entries) {
  const separator = "\u2502"
  const header = [
    "Name",
    "ID",
    "Comment",
    "Scopes",
    "Status",
    "Created",
    "Modified",
  ]
  const rows = [header, ...entries].map(
    (columns) =>
      `${separator} ${columns
        .map((column) => String(column))
        .join(` ${separator} `)} ${separator}`
  )
  return `\u001b[36mListing secrets\u001b[0m\n${rows.join("\n")}`
}

function activeBillingMetadata() {
  return BILLING_SECRET_BINDINGS.map(({ secretName }, index) => ({
    name: secretName,
    id: index === 0 ? adminSecretId : ingressSecretId,
    scopes: [BILLING_SECRET_SCOPE],
    status: "active",
  }))
}

describe("current repository secret assignment detection", () => {
  it.each([
    ["bare", () => `${adminName}=${literalValue}`],
    ["quoted", () => `${adminName}="${literalValue}"`],
    ["export", () => `export ${adminName}='${literalValue}'`],
    ["YAML", () => `${ingressName}: ${literalValue}`],
    ["JSON", () => JSON.stringify({ [adminName]: literalValue })],
    ["PowerShell", () => `$env:${ingressName} = '${literalValue}'`],
    ["mixed-case PowerShell", () => `$EnV:Ingress_Enc_Key = '${literalValue}'`],
  ])("flags a %s plaintext assignment", (_label, makeSource) => {
    const findings = findPlaintextSecretAssignments(makeSource())

    expect(findings).toHaveLength(1)
    expect(findings[0]).toEqual(
      expect.objectContaining({ line: 1, name: expect.any(String) })
    )
    expect(findings[0]).not.toHaveProperty("value")
  })

  it("allows explicit placeholders and environment references", () => {
    const githubReference = "$" + `{{ secrets.${adminName} }}`
    const sources = [
      `${adminName}=<set-via-cloudflare-secret>`,
      `${adminName}=<set-via-environment>`,
      `${adminName}=<redacted>`,
      `${adminName}=<test-fixture>`,
      `${adminName}=process.env.${adminName}`,
      `${adminName}: process.env["${adminName}"]`,
      `${adminName}=$${adminName}`,
      `${adminName}=\${${adminName}}`,
      `${adminName}=${githubReference}`,
    ]

    expect(findPlaintextSecretAssignments(sources.join("\n"))).toEqual([])
  })

  it("does not allow test-admin in production configuration", () => {
    const source = `admin_key="test-admin"`

    expect(
      findPlaintextSecretAssignments(source, {
        path: "workers/billing/wrangler.toml",
      })
    ).toEqual([{ line: 1, name: adminName }])
  })

  it("limits the legacy test-admin exemption to known fixture paths", () => {
    const source = `${adminName}: "test-admin"`

    expect(
      findPlaintextSecretAssignments(source, {
        path: "workers/billing/src/index.test.js",
      })
    ).toEqual([])
    expect(
      findPlaintextSecretAssignments(source, {
        path: "docs/superpowers/plans/legacy.md",
      })
    ).toEqual([])
  })

  it("uses git ls-files for the current repository file set", () => {
    const spawn = vi.fn(() => ({ status: 0, stdout: "one.mjs\0two.yaml\0" }))

    expect(listCurrentRepositoryFiles("C:\\repo", spawn)).toEqual([
      "one.mjs",
      "two.yaml",
    ])
    expect(spawn).toHaveBeenCalledWith(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      expect.objectContaining({ cwd: "C:\\repo", encoding: "utf8" })
    )
  })
})

describe("Billing Secrets Store provisioning", () => {
  it("uses the fixed account store and immutable versioned names", () => {
    expect(BILLING_SECRETS_STORE_ID).toBe("346e2b4b86334bc29083c064116e91cf")
    expect(BILLING_SECRET_BINDINGS).toEqual([
      {
        binding: adminName,
        secretName: "CINACHAIN_BILLING_ADMIN_KEY_V1",
      },
      {
        binding: ingressName,
        secretName: "CINACHAIN_BILLING_INGRESS_ENC_KEY_V1",
      },
    ])
  })

  it("invokes the locked Wrangler JavaScript entrypoint directly on Windows", () => {
    const invocation = wranglerInvocation("C:\\repo", "win32", () => true)

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.prefixArgs).toHaveLength(1)
    expect(invocation.prefixArgs[0]).toMatch(
      /[\\/]workers[\\/]billing[\\/]node_modules[\\/]wrangler[\\/]bin[\\/]wrangler\.js$/
    )
  })

  it("creates missing versions remotely using only stdin and a scrubbed env", () => {
    const environment = validSecretEnvironment()
    const calls = []
    const spawn = vi.fn((command, args, options) => {
      calls.push({ command, args, options })
      if (args.includes("list")) {
        return {
          status: 1,
          stdout: "",
          stderr: "List request returned no secrets",
        }
      }
      return { status: 0 }
    })

    const result = provisionBillingSecrets({
      environment,
      spawn,
      platform: "linux",
      rootDirectory: "/repo",
      binaryExists: () => true,
    })

    expect(result).toEqual({
      created: BILLING_SECRET_BINDINGS.map(({ secretName }) => secretName),
      skipped: [],
    })
    expect(calls).toHaveLength(1 + REQUIRED_BILLING_SECRETS.length)

    const listCall = calls[0]
    expect(listCall.args).toEqual(
      expect.arrayContaining([
        "secrets-store",
        "secret",
        "list",
        BILLING_SECRETS_STORE_ID,
        "--remote",
      ])
    )
    expect(listCall.options.env).not.toHaveProperty(adminName)
    expect(listCall.options.env).not.toHaveProperty(ingressName)

    calls.slice(1).forEach(({ command, args, options }, index) => {
      const { binding, secretName } = BILLING_SECRET_BINDINGS[index]
      expect(command).toMatch(
        /[\\/]workers[\\/]billing[\\/]node_modules[\\/].bin[\\/]wrangler$/
      )
      expect(args).toEqual(
        expect.arrayContaining([
          "secrets-store",
          "secret",
          "create",
          BILLING_SECRETS_STORE_ID,
          "--name",
          secretName,
          "--scopes",
          BILLING_SECRET_SCOPE,
          "--remote",
        ])
      )
      expect(args).not.toContain("--value")
      expect(args).not.toContain("--env")
      expect(args.join(" ")).not.toContain(environment[adminName])
      expect(args.join(" ")).not.toContain(environment[ingressName])
      expect(options.input).toBe(`${environment[binding]}\n`)
      expect(options.env).not.toHaveProperty(adminName)
      expect(options.env).not.toHaveProperty(ingressName)
      expect(options.env.CLOUDFLARE_API_TOKEN).toBe(
        environment.CLOUDFLARE_API_TOKEN
      )
    })
  })

  it("skips existing active immutable versions instead of overwriting them", () => {
    const table = secretsStoreTable(
      activeBillingMetadata().map(({ name, id, scopes, status }) => [
        name,
        id,
        "fixture",
        scopes.join(","),
        status,
        "fixture",
        "fixture",
      ])
    )
    const spawn = vi.fn(() => ({ status: 0, stdout: table, stderr: "" }))

    expect(
      provisionBillingSecrets({
        environment: {},
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        binaryExists: () => true,
      })
    ).toEqual({
      created: [],
      skipped: BILLING_SECRET_BINDINGS.map(({ secretName }) => secretName),
    })
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it("refuses to mutate an existing pending or wrongly scoped version", () => {
    const [{ secretName }] = BILLING_SECRET_BINDINGS
    const table = secretsStoreTable([
      [
        secretName,
        adminSecretId,
        "fixture",
        "ai_gateway",
        "pending",
        "fixture",
        "fixture",
      ],
    ])
    const spawn = vi.fn(() => ({ status: 0, stdout: table, stderr: "" }))

    expect(() =>
      provisionBillingSecrets({
        environment: validSecretEnvironment(),
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        binaryExists: () => true,
      })
    ).toThrow("will not mutate an existing version")
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it("validates missing values before creating any secret", () => {
    const spawn = vi.fn(() => ({
      status: 0,
      stdout: secretsStoreTable([]),
      stderr: "",
    }))

    expect(() =>
      provisionBillingSecrets({
        environment: {
          [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
          [ingressName]: "invalid",
        },
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        binaryExists: () => true,
      })
    ).toThrow(ingressName)
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it("rejects admin keys containing whitespace before any create call", () => {
    const spawn = vi.fn(() => ({
      status: 0,
      stdout: secretsStoreTable([]),
      stderr: "",
    }))

    expect(() =>
      provisionBillingSecrets({
        environment: {
          ...validSecretEnvironment(),
          [adminName]: `${"a".repeat(32)}\n`,
        },
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        binaryExists: () => true,
      })
    ).toThrow("must not contain whitespace")
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it("explains how to install the locked Wrangler binary when absent", () => {
    expect(() =>
      provisionBillingSecrets({
        environment: validSecretEnvironment(),
        binaryExists: () => false,
      })
    ).toThrow("npm --prefix workers/billing ci")
  })
})

describe("Billing Secrets Store binding verification", () => {
  it("parses active status and workers scope from Wrangler's ANSI table", () => {
    const [{ secretName }] = BILLING_SECRET_BINDINGS
    const table = secretsStoreTable([
      [
        secretName,
        adminSecretId,
        "fixture",
        BILLING_SECRET_SCOPE,
        "active",
        "fixture",
        "fixture",
      ],
    ])

    expect(parseSecretsStoreList(table)).toEqual([
      {
        name: secretName,
        id: adminSecretId,
        scopes: [BILLING_SECRET_SCOPE],
        status: "active",
      },
    ])
  })

  it("accepts both required active secrets with workers scope", () => {
    expect(findBillingSecretsStoreIssues(activeBillingMetadata())).toEqual([])
  })

  it("reports a missing required secret", () => {
    const metadata = activeBillingMetadata().slice(0, 1)

    expect(findBillingSecretsStoreIssues(metadata)).toEqual([
      {
        binding: ingressName,
        secretName: "CINACHAIN_BILLING_INGRESS_ENC_KEY_V1",
        reason: "missing",
      },
    ])
  })

  it("reports pending status and a missing workers scope", () => {
    const metadata = activeBillingMetadata()
    metadata[0] = { ...metadata[0], status: "pending" }
    metadata[1] = { ...metadata[1], scopes: ["ai_gateway"] }

    expect(findBillingSecretsStoreIssues(metadata)).toEqual([
      {
        binding: adminName,
        secretName: "CINACHAIN_BILLING_ADMIN_KEY_V1",
        reason: "status is pending; expected active",
      },
      {
        binding: ingressName,
        secretName: "CINACHAIN_BILLING_INGRESS_ENC_KEY_V1",
        reason: "scope workers is missing",
      },
    ])
  })

  it("lists the remote store without inheriting secret values", () => {
    const environment = validSecretEnvironment()
    const table = secretsStoreTable(
      activeBillingMetadata().map(({ name, id, scopes, status }) => [
        name,
        id,
        "fixture",
        scopes.join(","),
        status,
        "fixture",
        "fixture",
      ])
    )
    const spawn = vi.fn(() => ({ status: 0, stdout: table, stderr: "" }))

    expect(
      verifyBillingSecretNames({
        environment,
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        binaryExists: () => true,
      })
    ).toEqual([])

    const [command, args, options] = spawn.mock.calls[0]
    expect(command).toMatch(
      /[\\/]workers[\\/]billing[\\/]node_modules[\\/].bin[\\/]wrangler$/
    )
    expect(args).toEqual(
      expect.arrayContaining([
        "secrets-store",
        "secret",
        "list",
        BILLING_SECRETS_STORE_ID,
        "--remote",
      ])
    )
    expect(args).not.toContain("--env")
    expect(options.env).not.toHaveProperty(adminName)
    expect(options.env).not.toHaveProperty(ingressName)
    expect(options.env.CLOUDFLARE_API_TOKEN).toBe(
      environment.CLOUDFLARE_API_TOKEN
    )
  })

  it("explains how to install the locked Wrangler binary when absent", () => {
    expect(() =>
      verifyBillingSecretNames({
        environment: {},
        binaryExists: () => false,
      })
    ).toThrow("npm --prefix workers/billing ci")
  })
})
