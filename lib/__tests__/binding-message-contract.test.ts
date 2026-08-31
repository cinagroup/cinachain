import { describe, expect, it } from "vitest"

import { PRIMARY_CHAIN_ID } from "../../config/deployment"
import {
  BINDING_URI,
  buildBindingMessage as buildWorkerBindingMessage,
  CHAIN_ID,
} from "../../workers/billing/src/lib/sig-verify.js"
import {
  buildBindingMessage as buildClientBindingMessage,
  KEY_BINDING_CHAIN_ID,
  KEY_BINDING_URI,
} from "../binding-message"

describe("API-key binding protocol", () => {
  it("keeps client and Worker network metadata aligned", () => {
    expect(KEY_BINDING_CHAIN_ID).toBe(BigInt(PRIMARY_CHAIN_ID))
    expect(CHAIN_ID).toBe(BigInt(PRIMARY_CHAIN_ID))
    expect(KEY_BINDING_URI).toBe(BINDING_URI)
  })

  it("builds the same key-bound message on both sides of the protocol", () => {
    const address = "0x0000000000000000000000000000000000000001"
    const nonce = "0123456789abcdef0123456789abcdef"
    const issuedAt = "2026-08-11T00:00:00.000Z"
    const apiKeyHash = "ab".repeat(32)

    expect(
      buildClientBindingMessage(address, nonce, issuedAt, apiKeyHash)
    ).toBe(buildWorkerBindingMessage(address, nonce, issuedAt, apiKeyHash))
  })
})
