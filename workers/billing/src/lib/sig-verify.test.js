import { secp256k1 } from "@noble/curves/secp256k1.js"
import { keccak_256 } from "@noble/hashes/sha3.js"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { describe, expect, it } from "vitest"

import {
  buildBindingMessage,
  encodeIsValidSignature,
  parseBindingMessage,
  personalSignHash,
  recoverEOAAddress,
} from "./sig-verify.js"

function sign(message, privateKeyHex) {
  // We already hashed with keccak, so disable noble's prehash. Noble 1.x
  // returns a Signature object while 2.x returns recovered bytes; normalize
  // both into Ethereum's r || s || v encoding.
  const msgBytes = utf8ToBytes(message)
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  const hash = keccak_256(new Uint8Array([...prefix, ...msgBytes]))
  const pk = new Uint8Array(Buffer.from(privateKeyHex, "hex"))
  const signed = secp256k1.sign(hash, pk, {
    prehash: false,
    format: "recovered",
  })
  const compact =
    signed instanceof Uint8Array
      ? signed.slice(1)
      : typeof signed.toBytes === "function"
        ? signed.toBytes("compact")
        : signed.toCompactRawBytes()
  const recovery = signed instanceof Uint8Array ? signed[0] : signed.recovery
  if (recovery !== 0 && recovery !== 1) {
    throw new Error("unsupported Ethereum recovery bit")
  }
  const rHex = Buffer.from(compact.slice(0, 32)).toString("hex")
  const sHex = Buffer.from(compact.slice(32)).toString("hex")
  return `0x${rHex}${sHex}${(27 + recovery).toString(16)}`
}

describe("sig-verify", () => {
  const PK = "1111111111111111111111111111111111111111111111111111111111111111"

  it("buildBindingMessage has the expected shape", () => {
    const m = buildBindingMessage(
      "0x1111111111111111111111111111111111111111",
      "abc123",
      "2026-08-05T00:00:00Z"
    )
    expect(m).toContain("cinachain.com wants you to sign in")
    expect(m).toContain("Nonce: abc123")
    expect(m).toContain("Chain ID: 84532")
  })

  it("recovers the correct EOA address", () => {
    const address =
      "0x" +
      Buffer.from(
        keccak_256(
          secp256k1
            .getPublicKey(new Uint8Array(Buffer.from(PK, "hex")), false)
            .slice(1)
        )
      )
        .toString("hex")
        .slice(-40)
    const message = buildBindingMessage(
      address,
      "nonce123",
      "2026-08-05T00:00:00Z"
    )
    const sig = sign(message, PK)
    const recovered = recoverEOAAddress(message, sig)
    expect(recovered.toLowerCase()).toBe(address.toLowerCase())
  })

  it("returns null for malformed signatures", () => {
    expect(recoverEOAAddress("msg", "0xdead")).toBeNull()
    expect(recoverEOAAddress("msg", "")).toBeNull()
    expect(recoverEOAAddress("msg", null)).toBeNull()
  })

  it("returns null when recovery id is invalid", () => {
    const message = "some message"
    const badSig = `0x${"11".repeat(64)}${"22".repeat(64)}99` // v=0x99
    expect(recoverEOAAddress(message, badSig)).toBeNull()
  })

  it("encodes isValidSignature calldata", () => {
    const hash = "11".repeat(32)
    const call = encodeIsValidSignature(`0x${hash}`, "0x" + "22".repeat(65))
    expect(call.startsWith("0x1626ba7e")).toBe(true)
    // selector(10) + hash(64) + offset(64) + length(64) + data padded to 96
    // bytes (192 hex): 10 + 64 + 64 + 64 + 192 = 394
    expect(call).toHaveLength(394)
  })

  it("personalSignHash is deterministic", () => {
    const h1 = Buffer.from(personalSignHash("hello")).toString("hex")
    const h2 = Buffer.from(personalSignHash("hello")).toString("hex")
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
  })

  it("parseBindingMessage round-trips a binding message", () => {
    const address = "0x1111111111111111111111111111111111111111"
    const m = buildBindingMessage(
      address,
      "nonce-42",
      "2026-08-05T00:00:00.000Z"
    )
    const parsed = parseBindingMessage(m)
    expect(parsed).toEqual({
      address,
      nonce: "nonce-42",
      issuedAt: "2026-08-05T00:00:00.000Z",
      uri: "https://billing-api.cinachain.com",
      chainId: "84532",
    })
  })

  it("parseBindingMessage rejects malformed messages", () => {
    expect(parseBindingMessage(null)).toBeNull()
    expect(parseBindingMessage("not a binding message")).toBeNull()
    const good = buildBindingMessage(
      "0x1111111111111111111111111111111111111111",
      "n",
      "2026-08-05T00:00:00Z"
    )
    expect(parseBindingMessage(good.replace("Nonce: n", ""))).toBeNull()
    expect(
      parseBindingMessage(good.replace(/0x[0-9a-fA-F]{40}/, "0xzz"))
    ).toBeNull()
  })
})
