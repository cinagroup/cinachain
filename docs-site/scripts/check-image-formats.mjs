import { open, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_SOURCE_DIRS = ["docs", "blog", "src", "static"]
const BLOCKED_EXTENSIONS = new Map([
  [".avif", "AVIF/HEIF"],
  [".heic", "HEIF"],
  [".heif", "HEIF"],
  [".icns", "ICNS"],
  [".jxl", "JPEG XL"],
])
const ISO_BMFF_IMAGE_BRANDS = new Set([
  "avif",
  "avis",
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
])
const JPEG_XL_CONTAINER_SIGNATURE = Buffer.from([
  0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
])

function startsWith(buffer, signature) {
  return (
    buffer.length >= signature.length &&
    buffer.subarray(0, signature.length).equals(signature)
  )
}

export function detectUnsafeImageFormat(filePath, header) {
  const extension = path.extname(filePath).toLowerCase()
  const extensionFormat = BLOCKED_EXTENSIONS.get(extension)
  if (extensionFormat) {
    return `${extensionFormat} files are blocked while Docusaurus image-size has no upstream fix`
  }

  if (startsWith(header, Buffer.from("icns"))) {
    return "ICNS signature detected behind a non-ICNS extension"
  }

  if (
    (header.length >= 2 && header[0] === 0xff && header[1] === 0x0a) ||
    startsWith(header, JPEG_XL_CONTAINER_SIGNATURE)
  ) {
    return "JPEG XL signature detected behind a non-JXL extension"
  }

  if (
    header.length >= 12 &&
    header.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    const brandOffsets = [8]
    for (let offset = 16; offset + 4 <= header.length; offset += 4) {
      brandOffsets.push(offset)
    }
    if (
      brandOffsets.some((offset) =>
        ISO_BMFF_IMAGE_BRANDS.has(
          header.subarray(offset, offset + 4).toString("ascii")
        )
      )
    ) {
      return "HEIF/AVIF signature detected behind a non-HEIF extension"
    }
  }

  return null
}

async function readHeader(filePath) {
  const handle = await open(filePath, "r")
  try {
    const header = Buffer.alloc(32)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return header.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function collectFiles(directory, files, violations) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(entryPath, files, violations)
    } else if (entry.isSymbolicLink()) {
      violations.push({
        filePath: entryPath,
        reason: "symbolic links are not allowed in documentation source roots",
      })
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
}

export async function scanDocsImageSafety(
  rootDirectory,
  sourceDirectories = DEFAULT_SOURCE_DIRS
) {
  const files = []
  const violations = []

  for (const sourceDirectory of sourceDirectories) {
    const absoluteSource = path.join(rootDirectory, sourceDirectory)
    try {
      await collectFiles(absoluteSource, files, violations)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
  }

  for (const filePath of files) {
    const reason = detectUnsafeImageFormat(filePath, await readHeader(filePath))
    if (reason) violations.push({ filePath, reason })
  }

  return { filesScanned: files.length, violations }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (invokedPath === fileURLToPath(import.meta.url)) {
  const rootDirectory = process.cwd()
  const result = await scanDocsImageSafety(rootDirectory)

  if (result.violations.length > 0) {
    console.error("Documentation image safety check failed:")
    for (const violation of result.violations) {
      console.error(
        `- ${path.relative(rootDirectory, violation.filePath)}: ${
          violation.reason
        }`
      )
    }
    process.exitCode = 1
  } else {
    console.log(
      `Documentation image safety check passed (${result.filesScanned} files scanned).`
    )
  }
}
