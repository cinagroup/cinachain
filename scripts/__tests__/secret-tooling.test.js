import { describe, expect, it, vi } from "vitest"

import {
  findPlaintextSecretAssignments,
  listCurrentRepositoryFiles,
} from "../check-no-tracked-worker-secrets.mjs"
import {
  provisionBillingSecrets,
  REQUIRED_BILLING_SECRETS,
  wranglerInvocation,
} from "../provision-billing-secrets.mjs"
import { verifyBillingSecretNames } from "../verify-billing-secret-names.mjs"

const adminName = ["ADMIN", "KEY"].join("_")
const ingressName = ["INGRESS", "ENC", "KEY"].join("_")
const literalValue = ["fixture", "plain", "value"].join("-")

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

describe("Billing secret provisioning", () => {
  it("invokes the locked Wrangler JavaScript entrypoint directly on Windows", () => {
    const invocation = wranglerInvocation("C:\\repo", "win32", () => true)

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.prefixArgs).toHaveLength(1)
    expect(invocation.prefixArgs[0]).toMatch(
      /[\\/]workers[\\/]billing[\\/]node_modules[\\/]wrangler[\\/]bin[\\/]wrangler\.js$/
    )
  })

  it("passes only the current secret through stdin and scrubs both from env", () => {
    const values = {
      [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
      [ingressName]: "0123456789abcdef".repeat(4),
    }
    const environment = {
      ...values,
      CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
      PATH: "fixture-path",
      WRANGLER_ENV: "preview",
    }
    const calls = []
    const spawn = vi.fn((command, args, options) => {
      calls.push({ command, args, options })
      return { status: 0 }
    })

    provisionBillingSecrets({
      environment,
      spawn,
      platform: "linux",
      rootDirectory: "/repo",
      config: "/repo/wrangler.toml",
      binaryExists: () => true,
    })

    expect(calls).toHaveLength(REQUIRED_BILLING_SECRETS.length)
    calls.forEach(({ command, args, options }, index) => {
      const currentName = REQUIRED_BILLING_SECRETS[index]
      expect(command).toMatch(
        /[\\/]workers[\\/]billing[\\/]node_modules[\\/].bin[\\/]wrangler$/
      )
      expect(args).not.toContain("--yes")
      expect(args).not.toContain("wrangler@4.101.0")
      expect(args).toContain(currentName)
      expect(args).toEqual(expect.arrayContaining(["--env", "preview"]))
      expect(args.join(" ")).not.toContain(values.ADMIN_KEY)
      expect(args.join(" ")).not.toContain(values.INGRESS_ENC_KEY)
      expect(options.input).toBe(`${values[currentName]}\n`)
      expect(options.env).not.toHaveProperty("ADMIN_KEY")
      expect(options.env).not.toHaveProperty("INGRESS_ENC_KEY")
      expect(options.env.CLOUDFLARE_API_TOKEN).toBe(
        environment.CLOUDFLARE_API_TOKEN
      )
    })
  })

  it("validates all required values before starting Wrangler", () => {
    const spawn = vi.fn()

    expect(() =>
      provisionBillingSecrets({
        environment: {
          [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
          [ingressName]: "invalid",
        },
        spawn,
        binaryExists: () => true,
      })
    ).toThrow("INGRESS_ENC_KEY")
    expect(spawn).not.toHaveBeenCalled()
  })

  it("explains how to install the locked Wrangler binary when absent", () => {
    expect(() =>
      provisionBillingSecrets({
        environment: {
          [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
          [ingressName]: "0123456789abcdef".repeat(4),
        },
        binaryExists: () => false,
      })
    ).toThrow("npm --prefix workers/billing ci")
  })
})

describe("Billing secret binding verification", () => {
  it("explains how to install the locked Wrangler binary when absent", () => {
    expect(() =>
      verifyBillingSecretNames({
        environment: {},
        binaryExists: () => false,
      })
    ).toThrow("npm --prefix workers/billing ci")
  })

  it("uses the selected Wrangler environment without inheriting secret values", () => {
    const environment = {
      [adminName]: ["fixture", "admin", "x".repeat(32)].join("-"),
      [ingressName]: "0123456789abcdef".repeat(4),
      CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
      WRANGLER_ENV: "preview",
    }
    const spawn = vi.fn((_command, _args, _options) => ({
      status: 0,
      stdout: JSON.stringify(
        REQUIRED_BILLING_SECRETS.map((name) => ({ name }))
      ),
    }))

    expect(
      verifyBillingSecretNames({
        environment,
        spawn,
        platform: "linux",
        rootDirectory: "/repo",
        config: "/repo/wrangler.toml",
        binaryExists: () => true,
      })
    ).toEqual([])

    const [command, args, options] = spawn.mock.calls[0]
    expect(command).toMatch(
      /[\\/]workers[\\/]billing[\\/]node_modules[\\/].bin[\\/]wrangler$/
    )
    expect(args).not.toContain("--yes")
    expect(args).not.toContain("wrangler@4.101.0")
    expect(args).toEqual(expect.arrayContaining(["--env", "preview"]))
    expect(options.env).not.toHaveProperty("ADMIN_KEY")
    expect(options.env).not.toHaveProperty("INGRESS_ENC_KEY")
    expect(options.env.CLOUDFLARE_API_TOKEN).toBe(
      environment.CLOUDFLARE_API_TOKEN
    )
  })
})
