import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  detectUnsafeImageFormat,
  scanDocsImageSafety,
} from "../../docs-site/scripts/check-image-formats.mjs"

const temporaryDirectories = []

async function createTemporaryDocsSite() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cinachain-docs-"))
  temporaryDirectories.push(directory)
  await mkdir(path.join(directory, "static", "img"), { recursive: true })
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe("documentation image safety", () => {
  it("detects blocked extensions and disguised vulnerable image signatures", () => {
    expect(detectUnsafeImageFormat("asset.jxl", Buffer.alloc(0))).toMatch(
      /JPEG XL/
    )
    expect(
      detectUnsafeImageFormat("asset.png", Buffer.from("icns00000000"))
    ).toMatch(/ICNS signature/)
    expect(
      detectUnsafeImageFormat(
        "asset.png",
        Buffer.from([0xff, 0x0a, 0x00, 0x00])
      )
    ).toMatch(/JPEG XL signature/)

    const heifHeader = Buffer.alloc(16)
    heifHeader.write("ftyp", 4, "ascii")
    heifHeader.write("heic", 8, "ascii")
    expect(detectUnsafeImageFormat("asset.png", heifHeader)).toMatch(
      /HEIF\/AVIF signature/
    )

    const compatibleBrandHeader = Buffer.alloc(24)
    compatibleBrandHeader.write("ftyp", 4, "ascii")
    compatibleBrandHeader.write("isom", 8, "ascii")
    compatibleBrandHeader.write("heic", 16, "ascii")
    expect(
      detectUnsafeImageFormat("disguised.png", compatibleBrandHeader)
    ).toMatch(/HEIF\/AVIF signature/)
  })

  it("allows ordinary documentation assets", () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    expect(detectUnsafeImageFormat("asset.png", pngHeader)).toBeNull()
  })

  it("scans source roots and reports both extensions and disguised files", async () => {
    const rootDirectory = await createTemporaryDocsSite()
    const imageDirectory = path.join(rootDirectory, "static", "img")
    await writeFile(path.join(imageDirectory, "safe.png"), "safe")
    await writeFile(path.join(imageDirectory, "blocked.jxl"), "not-an-image")
    await writeFile(path.join(imageDirectory, "disguised.png"), "icns00000000")

    const result = await scanDocsImageSafety(rootDirectory)

    expect(result.filesScanned).toBe(3)
    expect(result.violations).toHaveLength(2)
    expect(
      result.violations.map(({ filePath }) => path.basename(filePath))
    ).toEqual(expect.arrayContaining(["blocked.jxl", "disguised.png"]))
  })
})
