// Upload CinaMega assets to 4EVERLAND and record the real CIDs.
//
// Pipeline (deterministic, no circular metadata reference):
//   1. Compute the file CID of each SVG locally (content-addressed — the
//      network CID is guaranteed identical).
//   2. Render each metadata.json with image = ipfs://<svgFileCid> (file CID,
//      NOT the directory CID — otherwise metadata would reference its own
//      directory and never be self-consistent).
//   3. Compute the directory CID of each (metadata.json + svg) pair — this
//      is the CID that goes into the contract (uri() = ipfs://<dirCid>/metadata.json).
//   4. Upload every file to 4EVERLAND via its S3-compatible Bucket API and
//      pin the directory CIDs via the Pinning API.
//   5. Write mega-assets/cids.json for init-mega-templates.mjs.
//
// Env:
//   FOUR_EVERLAND_TOKEN   — API token from 4everland.org console
//   FOUR_EVERLAND_BUCKET  — bucket name (default "cinachain-mega")
//
// Run: node scripts/upload-mega-assets.mjs
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"
import { importer } from "ipfs-unixfs-importer"
import { MemoryBlockstore } from "blockstore-core/memory"
import all from "it-all"

const ASSETS = resolve("mega-assets")
const TOKEN = process.env.FOUR_EVERLAND_TOKEN
const LOCAL_ONLY = process.env.LOCAL_ONLY === "1"
if (!TOKEN && !LOCAL_ONLY) {
  throw new Error("FOUR_EVERLAND_TOKEN required (4everland.org console → API Keys); or LOCAL_ONLY=1 to compute CIDs locally without uploading")
}

const TYPES = ["ucina", "mcina", "cina"]

async function fileCid(bytes) {
  const blockstore = new MemoryBlockstore()
  const entries = await all(importer([{ path: "f", content: bytes }], blockstore, { cidVersion: 0 }))
  return entries[0].cid.toString()
}

async function dirCid(files) {
  // files: [{ path, bytes }] → root directory CID (wrapWithDirectory adds
  // the wrapper node; its entry has an empty path and is emitted last).
  const blockstore = new MemoryBlockstore()
  const entries = await all(
    importer(
      files.map((f) => ({ path: f.path, content: f.bytes })),
      blockstore,
      { cidVersion: 0, wrapWithDirectory: true }
    )
  )
  const root = entries[entries.length - 1]
  if (root.path !== "") throw new Error("expected directory root as last import entry")
  return root.cid.toString()
}

async function main() {
  const svgCids = {}
  const dirCids = {}
  const uploads = [] // { key, bytes, contentType }

  for (const t of TYPES) {
    const svgBytes = readFileSync(resolve(ASSETS, `${t}.svg`))
    svgCids[t] = await fileCid(svgBytes)
    uploads.push({ key: `${t}.svg`, bytes: svgBytes, contentType: "image/svg+xml" })

    const metaPath = resolve(ASSETS, `${t}.metadata.json`)
    const meta = JSON.parse(readFileSync(metaPath, "utf8"))
    meta.image = `ipfs://${svgCids[t]}`
    meta.cid = svgCids[t] // convenience field for gateway tooling
    const metaBytes = Buffer.from(JSON.stringify(meta, null, 2))
    writeFileSync(metaPath, metaBytes) // persist rendered metadata
    uploads.push({ key: `${t}.metadata.json`, bytes: metaBytes, contentType: "application/json" })

    dirCids[t] = await dirCid([
      { path: "metadata.json", bytes: metaBytes },
      { path: `${t}.svg`, bytes: svgBytes },
    ])
    console.log(`   ✓ ${t}: dir ${dirCids[t]} (svg ${svgCids[t]})`)
  }

  // ── Upload to 4EVERLAND (S3-compatible Bucket API over fetch) ──
  if (LOCAL_ONLY) {
    console.log("\n🔒 LOCAL_ONLY=1 — skipping upload/pin (CIDs are content-addressed;")
    console.log("    re-run without LOCAL_ONLY once FOUR_EVERLAND_TOKEN is set, the CIDs")
    console.log("    will not change).")
  } else {
    const BUCKET = process.env.FOUR_EVERLAND_BUCKET ?? "cinachain-mega"
    const S3_ENDPOINT = "https://endpoint.4everland.co"
    console.log(`\n⬆️  Uploading ${uploads.length} files to 4EVERLAND bucket "${BUCKET}"...`)

    for (const u of uploads) {
      const url = `${S3_ENDPOINT}/${BUCKET}/${u.key}`
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": u.contentType,
          "x-amz-meta-cid": "true", // ask bucket API to return the CID
        },
        body: u.bytes,
      })
      if (!res.ok) {
        throw new Error(`upload ${u.key} failed: ${res.status} ${await res.text().catch(() => "")}`)
      }
      console.log(`   ✓ ${u.key}`)
    }

    // ── Pin the directory CIDs (Pinning API) ──
    console.log("\n📌 Pinning directory CIDs...")
    for (const t of TYPES) {
      const res = await fetch("https://api.4everland.org/v1/api/pin", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cid: dirCids[t] }),
      })
      const body = await res.text().catch(() => "")
      if (!res.ok) {
        // Non-fatal: the files were uploaded; pinning can be retried manually.
        console.warn(`   ⚠️  pin ${t} failed (${res.status} ${body.slice(0, 120)}) — retry later or pin in dashboard`)
      } else {
        console.log(`   ✓ pinned ${t} ${dirCids[t]}`)
      }
    }
  }

  const out = {
    ucina: dirCids.ucina,
    mcina: dirCids.mcina,
    cina: dirCids.cina,
    svgCids,
    uploadedAt: new Date().toISOString(),
  }
  writeFileSync(resolve(ASSETS, "cids.json"), JSON.stringify(out, null, 2))
  console.log(`\n✅ cids.json written — run scripts/init-mega-templates.mjs next.`)
}

main().catch((e) => {
  console.error("❌ Upload failed:", e?.message ?? e)
  process.exit(1)
})
