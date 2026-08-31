import { describe, expect, it } from "vitest"

import { createCinaChainSiweMessage } from "../siwe-message"

describe("createCinaChainSiweMessage", () => {
  it("binds the session to the requested account, origin, chain and expiry", () => {
    const result = createCinaChainSiweMessage({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      chainId: 84532,
      domain: "nft.cinachain.com",
      nonce: "abc12345",
      now: new Date("2026-08-31T00:00:00.000Z"),
      uri: "https://nft.cinachain.com",
    })

    expect(result.nonce).toBe("abc12345")
    expect(result.expirationTime).toBe("2026-09-01T00:00:00.000Z")
    expect(result.message).toContain(
      "nft.cinachain.com wants you to sign in with your Ethereum account:"
    )
    expect(result.message).toContain(
      "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa"
    )
    expect(result.message).toContain("URI: https://nft.cinachain.com")
    expect(result.message).toContain("Chain ID: 84532")
    expect(result.message).toContain("Nonce: abc12345")
    expect(result.message).toContain("Issued At: 2026-08-31T00:00:00.000Z")
    expect(result.message).toContain(
      "Expiration Time: 2026-09-01T00:00:00.000Z"
    )
  })

  it("generates a standards-compliant nonce when one is not supplied", () => {
    const result = createCinaChainSiweMessage({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      chainId: 84532,
      domain: "localhost:3000",
      now: new Date("2026-08-31T00:00:00.000Z"),
      uri: "http://localhost:3000",
    })

    expect(result.nonce).toMatch(/^[a-zA-Z0-9]{8,}$/)
    expect(result.message).toContain(`Nonce: ${result.nonce}`)
  })
})
