import { afterEach, describe, expect, it, vi } from "vitest"

import worker from "./index.js"
import {
  buildFallbackMetadata,
  cacheControlFor,
  createRateLimiter,
  decodeBytesReturn,
  encodeGetBackupSvg,
  extractCidPath,
  GET_BACKUP_SVG_SELECTOR,
  isAllowedMediaPath,
  parseCidMap,
  readResponseWithinLimit,
  validateMediaBytes,
} from "./lib/gateway-core.js"

const UCINA_CID = "QmUZa75SwGeYPFrVTxCQApYcm8XgpBiAUdrsbh4EtJFYxU"
const MCINA_CID = "Qme5t3gekoEcbBdVV2Vjz1ZktfeB6bsEBvGkwSR9SwSRz4"
const CINA_CID = "QmbmVXuZkzEQRVRhtENhYcE4zzJXBUjdm1kBtfwGFF2Awi"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("parseCidMap", () => {
  it("parses cid:type pairs", () => {
    expect(parseCidMap(`${UCINA_CID}:1,${MCINA_CID}:2,${CINA_CID}:3`)).toEqual({
      [UCINA_CID]: 1,
      [MCINA_CID]: 2,
      [CINA_CID]: 3,
    })
  })
  it("handles empty/whitespace", () => {
    expect(parseCidMap("")).toEqual({})
    expect(parseCidMap(undefined)).toEqual({})
    expect(parseCidMap(` ${UCINA_CID} : 1 `)).toEqual({ [UCINA_CID]: 1 })
    expect(parseCidMap("not-a-cid:1")).toEqual({})
  })
})

describe("extractCidPath", () => {
  it("parses /<cid>/<path>", () => {
    expect(extractCidPath(`/${UCINA_CID}/metadata.json`)).toEqual({
      cid: UCINA_CID,
      path: "metadata.json",
    })
    expect(extractCidPath(`/${UCINA_CID}/ucina.svg`)).toEqual({
      cid: UCINA_CID,
      path: "ucina.svg",
    })
  })
  it("rejects other shapes", () => {
    expect(extractCidPath("/")).toBeNull()
    expect(extractCidPath("/QmUcina")).toBeNull()
    expect(extractCidPath("/a/b/c")).toBeNull()
  })
})

describe("media allowlist and payload validation", () => {
  it("binds each configured CID type to its canonical filenames", () => {
    expect(isAllowedMediaPath(1, "metadata.json")).toBe(true)
    expect(isAllowedMediaPath(1, "ucina.svg")).toBe(true)
    expect(isAllowedMediaPath(1, "cina.svg")).toBe(false)
    expect(isAllowedMediaPath(1, "arbitrary.bin")).toBe(false)
  })

  it("rejects active SVG content and malformed metadata", () => {
    expect(
      validateMediaBytes(
        "ucina.svg",
        new TextEncoder().encode("<svg><path /></svg>")
      )
    ).toBe(true)
    expect(
      validateMediaBytes(
        "ucina.svg",
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>")
      )
    ).toBe(false)
    expect(
      validateMediaBytes("metadata.json", new TextEncoder().encode("{}"))
    ).toBe(false)
  })

  it("caps origin responses while streaming", async () => {
    const response = new Response(new Uint8Array(1025), {
      headers: { "Content-Length": "1025" },
    })
    await expect(
      readResponseWithinLimit(response, 1024)
    ).rejects.toBeInstanceOf(RangeError)
  })
})

describe("media worker route enforcement", () => {
  const env = {
    MEGA_TYPE_CIDS: `${UCINA_CID}:1`,
    CINA_MEGA_MEDIA: { get: vi.fn(), put: vi.fn() },
  }

  it("rejects unknown CIDs before reading R2", async () => {
    const response = await worker.fetch(
      new Request(`https://media.cinachain.com/${CINA_CID}/metadata.json`),
      env
    )
    expect(response.status).toBe(404)
    expect(env.CINA_MEGA_MEDIA.get).not.toHaveBeenCalled()
  })

  it("rejects non-canonical filenames before reading R2", async () => {
    const response = await worker.fetch(
      new Request(`https://media.cinachain.com/${UCINA_CID}/cina.svg`),
      env
    )
    expect(response.status).toBe(404)
    expect(env.CINA_MEGA_MEDIA.get).not.toHaveBeenCalled()
  })

  it("keeps browser-visible error status for allowed origins", async () => {
    const response = await worker.fetch(
      new Request("https://media.cinachain.com/invalid", {
        headers: { Origin: "https://nft.cinachain.com" },
      }),
      env
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://nft.cinachain.com"
    )
    expect(response.headers.get("Vary")).toBe("Origin")
  })

  it("handles allowed and rejected CORS preflights explicitly", async () => {
    const allowed = await worker.fetch(
      new Request("https://media.cinachain.com/health", {
        method: "OPTIONS",
        headers: { Origin: "https://nft.cinachain.com" },
      }),
      env
    )
    const rejected = await worker.fetch(
      new Request("https://media.cinachain.com/health", {
        method: "OPTIONS",
        headers: { Origin: "https://attacker.example" },
      }),
      env
    )

    expect(allowed.status).toBe(204)
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://nft.cinachain.com"
    )
    expect(allowed.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, OPTIONS"
    )
    expect(rejected.status).toBe(403)
    expect(rejected.headers.has("Access-Control-Allow-Origin")).toBe(false)
    expect(rejected.headers.get("Vary")).toBe("Origin")
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
    const meta = JSON.parse(
      buildFallbackMetadata(1, new Uint8Array([0x3c, 0x73, 0x76, 0x67]))
    )
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
    expect(cacheControlFor("ucina.svg")).toBe(
      "public, max-age=2592000, immutable"
    )
  })
})
