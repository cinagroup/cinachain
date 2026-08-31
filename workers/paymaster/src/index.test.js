import { afterEach, describe, expect, it, vi } from "vitest"

import worker from "./index.js"

const ENTRYPOINT = "0x1111111111111111111111111111111111111111"
const ENABLED_ENV = {
  PAYMASTER_ENABLED: "true",
  PAYMASTER_POLICY_MODE: "cdp-dashboard-enforced",
  ENTRYPOINT_ADDRESS: ENTRYPOINT,
  CDP_PAYMASTER_URL:
    "https://api.developer.coinbase.com/rpc/v1/base-sepolia/test-key",
}

function request(payload) {
  return new Request("https://paymaster-api.cinachain.com/v1/paymaster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  })
}

function validPayload() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "pm_sponsorUserOperation",
    params: [
      {
        sender: "0x2222222222222222222222222222222222222222",
        nonce: "0x0",
        callData: "0x",
      },
      ENTRYPOINT,
    ],
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("paymaster policy gateway", () => {
  it("is fail-closed by default", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(request(validPayload()), {})
    expect(response.status).toBe(503)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("exposes only the canonical paymaster route", async () => {
    const response = await worker.fetch(
      new Request("https://paymaster-api.cinachain.com/api/paymaster", {
        method: "POST",
      }),
      ENABLED_ENV
    )
    expect(response.status).toBe(404)
  })

  it("rejects unrelated JSON-RPC methods before upstream fetch", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const payload = { ...validPayload(), method: "eth_sendUserOperation" }
    const response = await worker.fetch(request(payload), ENABLED_ENV)
    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("caps request bytes while streaming", async () => {
    const response = await worker.fetch(
      request("x".repeat(16_385)),
      ENABLED_ENV
    )
    expect(response.status).toBe(413)
  })

  it("forwards a policy-constrained sponsorship request", async () => {
    const fetchSpy = vi.fn(
      async () => new Response('{"jsonrpc":"2.0","id":1,"result":{}}')
    )
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(request(validPayload()), ENABLED_ENV)
    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
