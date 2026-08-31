import { afterEach, describe, expect, it, vi } from "vitest"

import worker from "./index.js"

const ENV = {
  CINAAUTH_UPSTREAM: "https://auth.cinaseek.ai",
  CINAAUTH_CLIENT_ID: "test-client",
  CINAAUTH_CLIENT_SECRET: "cina_cs_testsecret",
  ALLOWED_ORIGINS: "https://nft.cinachain.com,http://localhost:3000",
  ALLOWED_REDIRECT_URIS:
    "https://nft.cinachain.com/auth/callback,http://localhost:3000/auth/callback",
}

const VALID_VERIFIER = "v".repeat(43)

function tokenBody(overrides = {}) {
  return new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "test-client",
    code: "one-time-code",
    redirect_uri: "https://nft.cinachain.com/auth/callback",
    code_verifier: VALID_VERIFIER,
    ...overrides,
  }).toString()
}

function captureUpstreamFetch() {
  const captured = {}
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request) => {
      captured.request = request
      return new Response('{"ok":true}', {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "a=1",
        },
      })
    })
  )
  return captured
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("cinachain-auth-proxy", () => {
  it("injects client_secret_basic on token requests and strips browser headers", async () => {
    const captured = captureUpstreamFetch()
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://nft.cinachain.com",
          cookie: "session=1",
        },
        body: tokenBody(),
      }
    )
    const response = await worker.fetch(request, ENV)

    // Path-preserving forward to the upstream origin.
    expect(captured.request.url).toBe(
      "https://auth.cinaseek.ai/api/auth/oauth2/token"
    )
    // RFC 6749 §2.3.1 credentials (plain alnum here, so no form-encoding).
    expect(captured.request.headers.get("authorization")).toBe(
      `Basic ${btoa("test-client:cina_cs_testsecret")}`
    )
    // The upstream must never see the DApp's same-origin browser headers.
    expect(captured.request.headers.get("origin")).toBeNull()
    expect(captured.request.headers.get("cookie")).toBeNull()
    // The buffered-body forward carries the grant payload through.
    expect(await captured.request.text()).toBe(tokenBody())
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("form-encodes credentials with special characters", async () => {
    const captured = captureUpstreamFetch()
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody({ client_id: "my+client id" }),
      }
    )
    await worker.fetch(request, {
      ...ENV,
      CINAAUTH_CLIENT_ID: "my+client id",
      CINAAUTH_CLIENT_SECRET: "test-secret/special+value",
    })
    expect(captured.request.headers.get("authorization")).toBe(
      `Basic ${btoa(
        `${encodeURIComponent("my+client id")}:${encodeURIComponent(
          "test-secret/special+value"
        )}`
      )}`
    )
  })

  it("passes through without authorization when no secret is configured", async () => {
    const captured = captureUpstreamFetch()
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody(),
      }
    )
    await worker.fetch(request, { ...ENV, CINAAUTH_CLIENT_SECRET: undefined })
    expect(captured.request.headers.get("authorization")).toBeNull()
  })

  it("never adds client credentials to non-token requests", async () => {
    const captured = captureUpstreamFetch()
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/userinfo",
      { headers: { authorization: "Bearer cina_at_x" } }
    )
    const response = await worker.fetch(request, ENV)

    expect(captured.request.headers.get("authorization")).toBe(
      "Bearer cina_at_x"
    )
    // No Origin header on the incoming request → no CORS echo.
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("replaces caller-controlled credentials on token requests", async () => {
    const captured = captureUpstreamFetch()
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: {
          authorization: "Basic attacker-controlled",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: tokenBody(),
      }
    )
    await worker.fetch(request, ENV)
    expect(captured.request.headers.get("authorization")).toBe(
      `Basic ${btoa("test-client:cina_cs_testsecret")}`
    )
  })

  it("rejects non-code grants and unexpected proxy paths", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const tokenRequest = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody({ grant_type: "refresh_token" }),
      }
    )
    const grantResponse = await worker.fetch(tokenRequest, ENV)
    const pathResponse = await worker.fetch(
      new Request("https://nft.cinachain.com/api/auth/oauth2/register"),
      ENV
    )
    expect(grantResponse.status).toBe(400)
    expect(pathResponse.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects oversized token bodies before upstream fetch", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `code=${"x".repeat(17_000)}`,
      }
    )
    const response = await worker.fetch(request, ENV)
    expect(response.status).toBe(413)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("enforces the optional Cloudflare rate-limit binding", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(
      new Request(
        "https://nft.cinachain.com/api/auth/.well-known/openid-configuration"
      ),
      {
        ...ENV,
        AUTH_RATE_LIMITER: { limit: vi.fn(() => ({ success: false })) },
      }
    )
    expect(response.status).toBe(429)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("answers CORS preflight for allowed origins", async () => {
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/token",
      { method: "OPTIONS", headers: { origin: "http://localhost:3000" } }
    )
    const response = await worker.fetch(request, ENV)

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    )
  })

  it("does not echo CORS headers for unknown origins", async () => {
    const request = new Request(
      "https://nft.cinachain.com/api/auth/oauth2/userinfo",
      { headers: { origin: "https://evil.example" } }
    )
    const response = await worker.fetch(request, ENV)

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})
