import { describe, it, expect } from "vitest"
import {
  parseCidMap,
  extractCidPath,
  decodeBytesReturn,
  buildFallbackMetadata,
  encodeGetBackupSvg,
  createRateLimiter,
  cacheControlFor,
  GET_BACKUP_SVG_SELECTOR,
} from "./lib/gateway-core.js"

describe("parseCidMap", () => {
  it("parses cid:type pairs", () => {
    expect(parseCidMap("QmU:1,QmM:2,QmC:3")).toEqual({ QmU: 1, QmM: 2, QmC: 3 })
  })
  it("handles empty/whitespace", () => {
    expect(parseCidMap("")).toEqual({})
    expect(parseCidMap(undefined)).toEqual({})
    expect(parseCidMap(" QmU : 1 ")).toEqual({ QmU: 1 })
  })
})

describe("extractCidPath", () => {
  it("parses /<cid>/<path>", () => {
    expect(extractCidPath("/QmUcina/metadata.json")).toEqual({ cid: "QmUcina", path: "metadata.json" })
    expect(extractCidPath("/QmUcina/ucina.svg")).toEqual({ cid: "QmUcina", path: "ucina.svg" })
  })
  it("rejects other shapes", () => {
    expect(extractCidPath("/")).toBeNull()
    expect(extractCidPath("/QmUcina")).toBeNull()
    expect(extractCidPath("/a/b/c")).toBeNull()
  })
})

describe("decodeBytesReturn", () => {
  it("decodes an ABI bytes return value", () => {
    // offset=0x20, length=3, data=abc
    const hex =
      "0x" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "0000000000000000000000000000000000000000000000000000000000000003" +
      "6162630000000000000000000000000000000000000000000000000000000000"
    const out = decodeBytesReturn(hex)
    expect(out).toEqual(new Uint8Array([0x61, 0x62, 0x63]))
  })
  it("returns empty for null/0x", () => {
    expect(decodeBytesReturn(null)).toEqual(new Uint8Array(0))
    expect(decodeBytesReturn("0x")).toEqual(new Uint8Array(0))
    expect(decodeBytesReturn(undefined)).toEqual(new Uint8Array(0))
  })
  it("returns empty on truncated data", () => {
    expect(decodeBytesReturn("0x" + "00".repeat(30))).toEqual(new Uint8Array(0))
  })
})

describe("buildFallbackMetadata", () => {
  it("assembles json with data-uri image", () => {
    const meta = JSON.parse(buildFallbackMetadata(1, new Uint8Array([0x3c, 0x73, 0x76, 0x67])))
    expect(meta.name).toBe("UCINA — CinaMega #1")
    expect(meta.image).toBe("data:image/svg+xml;base64,PHN2Zw==")
    expect(meta.attributes[1].value).toBe("1")
  })
  it("rejects unknown type", () => {
    expect(buildFallbackMetadata(4, new Uint8Array(0))).toBeNull()
  })
})

describe("encodeGetBackupSvg", () => {
  it("uses the verified on-chain selector", () => {
    // keccak256("getBackupSvgRaw(uint256)")[0:4] — regression guard against
    // placeholder values silently breaking the chain fallback
    expect(GET_BACKUP_SVG_SELECTOR).toBe("0x3385be15")
  })
  it("encodes selector + padded type", () => {
    const call = encodeGetBackupSvg(1)
    expect(call.startsWith(GET_BACKUP_SVG_SELECTOR)).toBe(true)
    expect(call).toHaveLength(10 + 64)
    expect(call.endsWith("1".padStart(64, "0"))).toBe(true)
  })
})

describe("createRateLimiter", () => {
  it("allows up to max per second", () => {
    const limiter = createRateLimiter(5)
    for (let i = 0; i < 5; i++) expect(limiter.allow()).toBe(true)
    expect(limiter.allow()).toBe(false)
    expect(limiter.size()).toBe(5)
  })
  it("slides the window after 1s", async () => {
    const limiter = createRateLimiter(2)
    limiter.allow()
    limiter.allow()
    await new Promise((r) => setTimeout(r, 1100))
    expect(limiter.allow()).toBe(true)
  })
})

describe("cacheControlFor", () => {
  it("aligns with the _headers contract", () => {
    expect(cacheControlFor("metadata.json")).toBe("public, max-age=600")
    expect(cacheControlFor("ucina.svg")).toBe("public, max-age=2592000, immutable")
  })
})
