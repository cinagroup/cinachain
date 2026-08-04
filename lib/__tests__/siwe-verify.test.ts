import { verifyMessage } from "viem/actions"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { verifySiweSignature } from "../siwe-verify"

// Mock viem's verifyMessage action to avoid real RPC calls. The action
// lives in "viem/actions" (the top-level "viem" export is the EOA-only
// recovery utility, not the client-based verifier).
vi.mock("viem/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem/actions")>()
  return {
    ...actual,
    verifyMessage: vi.fn(),
  }
})

const mockPublicClient = {} as any

describe("verifySiweSignature", () => {
  beforeEach(() => {
    vi.mocked(verifyMessage).mockReset()
  })

  it("returns true when viem verifyMessage succeeds", async () => {
    vi.mocked(verifyMessage).mockResolvedValue(true)
    const ok = await verifySiweSignature(mockPublicClient, {
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "Sign in to CinaChain",
      signature: "0x1234",
    })
    expect(ok).toBe(true)
    expect(verifyMessage).toHaveBeenCalledWith(mockPublicClient, {
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "Sign in to CinaChain",
      signature: "0x1234",
    })
  })

  it("returns false when viem verifyMessage rejects (e.g. bad signature)", async () => {
    vi.mocked(verifyMessage).mockRejectedValue(new Error("invalid signature"))
    const ok = await verifySiweSignature(mockPublicClient, {
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "Sign in to CinaChain",
      signature: "0xdeadbeef",
    })
    expect(ok).toBe(false)
  })

  it("returns false when viem verifyMessage returns false", async () => {
    vi.mocked(verifyMessage).mockResolvedValue(false)
    const ok = await verifySiweSignature(mockPublicClient, {
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "nope",
      signature: "0x0000",
    })
    expect(ok).toBe(false)
  })
})
