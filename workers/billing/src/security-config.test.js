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

describe("billing Worker secret configuration", () => {
  it("never stores required secrets in plaintext vars", () => {
    const vars = section("vars")
    expect(vars).not.toMatch(/^\s*ADMIN_KEY\s*=/m)
    expect(vars).not.toMatch(/^\s*INGRESS_ENC_KEY\s*=/m)
  })

  it("declares both encrypted bindings as required", () => {
    const secrets = section("secrets")
    expect(secrets).toMatch(/required\s*=\s*\[[^\]]*"ADMIN_KEY"/)
    expect(secrets).toMatch(/required\s*=\s*\[[^\]]*"INGRESS_ENC_KEY"/)
  })
})
