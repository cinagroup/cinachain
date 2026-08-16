import { describe, expect, it } from "vitest"

import {
  rewriteProxiedEndpoints,
  shouldFallbackScope,
  stripOfflineAccess,
} from "../auth/cinaauth-endpoints"

const ISSUER = "https://auth.cinaseek.ai"
const PROXY = "https://nft.cinachain.com/api/auth"

function discoveryFixture() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/api/auth/oauth2/authorize`,
    token_endpoint: `${ISSUER}/api/auth/oauth2/token`,
    userinfo_endpoint: `${ISSUER}/api/auth/oauth2/userinfo`,
    jwks_uri: `${ISSUER}/api/auth/jwks`,
    revocation_endpoint: `${ISSUER}/api/auth/oauth2/revoke`,
    end_session_endpoint: `${ISSUER}/api/auth/oauth2/end-session`,
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic"],
  }
}

describe("rewriteProxiedEndpoints", () => {
  it("rewrites browser-fetched endpoints to the same-origin proxy", () => {
    const metadata = rewriteProxiedEndpoints(discoveryFixture(), ISSUER, PROXY)

    expect(metadata.token_endpoint).toBe(`${PROXY}/oauth2/token`)
    expect(metadata.userinfo_endpoint).toBe(`${PROXY}/oauth2/userinfo`)
    expect(metadata.jwks_uri).toBe(`${PROXY}/jwks`)
    expect(metadata.revocation_endpoint).toBe(`${PROXY}/oauth2/revoke`)
  })

  it("keeps issuer and navigation endpoints on the issuer origin", () => {
    const metadata = rewriteProxiedEndpoints(discoveryFixture(), ISSUER, PROXY)

    expect(metadata.issuer).toBe(ISSUER)
    expect(metadata.authorization_endpoint).toBe(
      `${ISSUER}/api/auth/oauth2/authorize`
    )
    expect(metadata.end_session_endpoint).toBe(
      `${ISSUER}/api/auth/oauth2/end-session`
    )
  })

  it("leaves foreign URLs untouched", () => {
    const metadata = rewriteProxiedEndpoints(
      { ...discoveryFixture(), token_endpoint: "https://evil.example/token" },
      ISSUER,
      PROXY
    )

    expect(metadata.token_endpoint).toBe("https://evil.example/token")
  })
})

describe("offline_access scope fallback", () => {
  const tx = (scope: string, scopeFallback = false) => ({ scope, scopeFallback })
  const invalidScope = {
    error: "invalid_scope",
    error_description: "The following scopes are invalid: offline_access",
  }

  it("falls back when offline_access is rejected on a first attempt", () => {
    expect(shouldFallbackScope(invalidScope, tx("openid profile email offline_access"))).toBe(true)
  })

  it("does not retry twice", () => {
    expect(
      shouldFallbackScope(invalidScope, tx("openid profile email", true))
    ).toBe(false)
  })

  it("ignores other errors and other scopes", () => {
    expect(shouldFallbackScope({ error: "access_denied" }, tx("openid profile email offline_access"))).toBe(false)
    expect(
      shouldFallbackScope(
        { error: "invalid_scope", error_description: "The following scopes are invalid: profile" },
        tx("openid profile email offline_access")
      )
    ).toBe(false)
    // offline_access was never requested
    expect(shouldFallbackScope(invalidScope, tx("openid profile email"))).toBe(false)
  })

  it("strips only offline_access from the scope list", () => {
    expect(stripOfflineAccess("openid profile email offline_access")).toBe(
      "openid profile email"
    )
    expect(stripOfflineAccess("openid profile email")).toBe("openid profile email")
  })
})
