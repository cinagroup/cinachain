// workers/billing/src/lib/ingress.js tests
import { describe, it, expect } from "vitest"
import { ingressRecord, ingressStatusTransitions, validateDeclaredMicro, encryptKey, decryptKey } from "./ingress.js"

describe("ingressRecord", () => {
  it("builds a pending record with defaults", () => {
    const rec = ingressRecord({ owner: "0xaaa", model: "demo", declaredMicro: "500000000", keyHash: "0xdead" })
    expect(rec.owner).toBe("0xaaa")
    expect(rec.model).toBe("demo")
    expect(rec.declaredMicro).toBe("500000000")
    expect(rec.confirmedMicro).toBe("0")
    expect(rec.status).toBe("pending")
    expect(rec.keyHash).toBe("0xdead")
    expect(typeof rec.createdAt).toBe("number")
  })
})

describe("validateDeclaredMicro", () => {
  it("accepts positive integers", () => {
    expect(validateDeclaredMicro("1000000")).toBe("1000000")
    expect(validateDeclaredMicro(5000000)).toBe("5000000")
  })
  it("rejects zero/negative/non-numeric", () => {
    expect(() => validateDeclaredMicro("0")).toThrow(/positive/)
    expect(() => validateDeclaredMicro("-5")).toThrow(/positive/)
    expect(() => validateDeclaredMicro("abc")).toThrow(/integer/)
    expect(() => validateDeclaredMicro("1.5")).toThrow(/integer/)
  })
  it("caps at MAX_DECLARED_MICRO", () => {
    expect(() => validateDeclaredMicro("1000000000000001")).toThrow(/too large/)
  })
})

describe("ingressStatusTransitions", () => {
  it("pending -> minting -> minted", () => {
    expect(ingressStatusTransitions("pending", "minting")).toBe(true)
    expect(ingressStatusTransitions("minting", "minted")).toBe(true)
  })
  it("rejects invalid transitions", () => {
    expect(ingressStatusTransitions("pending", "minted")).toBe(false)
    expect(ingressStatusTransitions("minting", "pending")).toBe(false)
    expect(ingressStatusTransitions("minted", "minting")).toBe(false)
  })
  it("allows pending -> rejected", () => {
    expect(ingressStatusTransitions("pending", "rejected")).toBe(true)
  })
})

describe("ingress key encryption", () => {
  const SECRET = "ab".repeat(32) // 32-byte hex
  it("encrypt -> decrypt roundtrips the raw key", async () => {
    const raw = "sk-ingress_roundtrip_0123456789abcdef"
    const enc = await encryptKey(SECRET, raw)
    expect(enc.iv).toMatch(/^[0-9a-f]{24}$/)
    expect(enc.cipher).toMatch(/^[0-9a-f]+$/)
    expect(enc.cipher).not.toContain(raw)
    const dec = await decryptKey(SECRET, enc)
    expect(dec).toBe(raw)
  })
  it("decrypt with wrong key fails", async () => {
    const enc = await encryptKey(SECRET, "sk-ingress_wrongkey_0123456789abcdef")
    await expect(decryptKey("cd".repeat(32), enc)).rejects.toThrow()
  })
})
