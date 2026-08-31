import { beforeEach, describe, expect, it, vi } from "vitest"

import worker from "./index.js"

const ADDRESS = "0x1111111111111111111111111111111111111111"

function createEnv() {
  const values = new Map()
  return {
    ADMIN_TOKEN: "test-admin-secret",
    CINA_WHITELIST_KV: {
      get: vi.fn(async (key) => values.get(key) ?? null),
      put: vi.fn(async (key, value) => {
        values.set(key, value)
      }),
    },
  }
}

function adminRequest(body) {
  return new Request("https://whitelist-api.cinachain.com/admin/whitelist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": "test-admin-secret",
    },
    body: JSON.stringify(body),
  })
}

describe("whitelist API v3", () => {
  let env

  beforeEach(() => {
    env = createEnv()
  })

  it("rejects off-chain limits below the deployed contract cap", async () => {
    const response = await worker.fetch(
      adminRequest({ addresses: [ADDRESS], limits: { [ADDRESS]: 1 } }),
      env
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("on-chain limit")
  })

  it("stores a whitelist and always returns the enforceable limit", async () => {
    const upload = await worker.fetch(
      adminRequest({ addresses: [ADDRESS], mintLimit: 3 }),
      env
    )
    expect(upload.status).toBe(200)

    const lookup = await worker.fetch(
      new Request(`https://whitelist-api.cinachain.com/whitelist/${ADDRESS}`),
      env
    )
    expect(lookup.status).toBe(200)
    expect(await lookup.json()).toMatchObject({
      eligible: true,
      mintLimit: 3,
      phase: "whitelist",
    })
  })

  it("rejects trailing route segments instead of accepting path variants", async () => {
    const response = await worker.fetch(
      new Request(
        `https://whitelist-api.cinachain.com/whitelist/${ADDRESS}/extra`
      ),
      env
    )
    expect(response.status).toBe(404)
    expect(env.CINA_WHITELIST_KV.get).not.toHaveBeenCalled()
  })

  it("caps the admin body before parsing", async () => {
    const response = await worker.fetch(
      new Request("https://whitelist-api.cinachain.com/admin/whitelist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": "test-admin-secret",
        },
        body: `{"padding":"${"x".repeat(513 * 1024)}"}`,
      }),
      env
    )
    expect(response.status).toBe(413)
  })

  it("fails closed when the Cloudflare rate limiter errors", async () => {
    env.WHITELIST_RATE_LIMITER = {
      limit: vi.fn(() => Promise.reject(new Error("down"))),
    }
    const response = await worker.fetch(
      new Request(`https://whitelist-api.cinachain.com/whitelist/${ADDRESS}`),
      env
    )
    expect(response.status).toBe(503)
  })
})
