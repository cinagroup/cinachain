import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const config = readFileSync(
  new URL("../wrangler.toml", import.meta.url),
  "utf8"
)

function section(name) {
  const match = config.match(
    new RegExp(`\\[${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`)
  )
  return match?.[1] ?? ""
}

function secretStoreBindings() {
  return [
    ...config.matchAll(/\[\[secrets_store_secrets\]\]([\s\S]*?)(?=\n\[|$)/g),
  ].map(([, block]) =>
    Object.fromEntries(
      [...block.matchAll(/^\s*([a-z_]+)\s*=\s*"([^"]+)"\s*$/gm)].map(
        ([, key, value]) => [key, value]
      )
    )
  )
}

describe("billing Worker secret configuration", () => {
  it("never stores required secrets in plaintext vars", () => {
    const vars = section("vars")
    expect(vars).not.toMatch(/^\s*ADMIN_KEY\s*=/m)
    expect(vars).not.toMatch(/^\s*INGRESS_ENC_KEY\s*=/m)
  })

  it("uses account-level Secrets Store bindings instead of Worker secrets", () => {
    expect(config).not.toMatch(/^\s*\[secrets\]\s*$/m)
    expect(secretStoreBindings()).toEqual([
      {
        binding: "ADMIN_KEY",
        store_id: "346e2b4b86334bc29083c064116e91cf",
        secret_name: "CINACHAIN_BILLING_ADMIN_KEY_V1",
      },
      {
        binding: "INGRESS_ENC_KEY",
        store_id: "346e2b4b86334bc29083c064116e91cf",
        secret_name: "CINACHAIN_BILLING_INGRESS_ENC_KEY_V1",
      },
    ])
  })
})
