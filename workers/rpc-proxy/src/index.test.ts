import { afterEach, describe, expect, it, vi } from "vitest"

import worker from "./index"

const rpcRequest = (body: unknown, headers: HeadersInit = {}) =>
  new Request("https://rpc-proxy.cinachain.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("RPC proxy abuse controls", () => {
  it("forwards one allowed JSON-RPC operation", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response('{"jsonrpc":"2.0","id":1,"result":"0x14a34"}')
      )
    )
    vi.stubGlobal("fetch", fetchSpy)

    const response = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      {}
    )
    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("rejects every JSON-RPC batch before upstream fetch", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(
      rpcRequest([
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      ]),
      {}
    )
    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("measures the request cap in bytes before parsing", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(rpcRequest("x".repeat(65_537)), {})
    expect(response.status).toBe(413)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects RPC parameter shapes that can create oversized responses", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(
      rpcRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBlockByNumber",
        params: ["latest", true],
      }),
      {}
    )
    expect(response.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fails closed when the rate-limit binding is unavailable", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const response = await worker.fetch(
      rpcRequest({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      {
        RPC_RATE_LIMITER: {
          limit: vi.fn(() => Promise.reject(new Error("down"))),
        },
      }
    )
    expect(response.status).toBe(503)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
