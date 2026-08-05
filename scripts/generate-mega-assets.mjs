// Generate CinaMega template assets: 3 SVG cards + 3 metadata.json
// (1024×1024 pure vector, no embedded bitmaps — SVGO-able).
// Output: mega-assets/{ucina,mcina,cina}.svg + mega-assets/*.metadata.json
// The metadata `image` field carries a __CID__ placeholder that
// upload-mega-assets.mjs replaces with the real 4EVERLAND directory CID.
import { writeFileSync, mkdirSync } from "fs"
import { resolve } from "path"

const OUT = resolve("mega-assets")
mkdirSync(OUT, { recursive: true })

const TYPES = [
  {
    name: "ucina",
    title: "UCINA",
    sub: "THE BASE UNIT",
    color: "#0ea5e9",
    colorDark: "#0369a1",
    rate: "1 UCINA",
    tokenId: 1,
  },
  {
    name: "mcina",
    title: "MCINA",
    sub: "1 MCINA = 1,000 UCINA",
    color: "#10b981",
    colorDark: "#047857",
    rate: "1 MCINA",
    tokenId: 2,
  },
  {
    name: "cina",
    title: "CINA",
    sub: "1 CINA = 1,000,000 UCINA",
    color: "#f59e0b",
    colorDark: "#b45309",
    rate: "1 CINA",
    tokenId: 3,
  },
]

function svg(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.colorDark}"/>
      <stop offset="1" stop-color="${t.color}"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#111c33"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect x="112" y="112" width="800" height="800" rx="48" fill="url(#card)" stroke="${t.color}" stroke-width="6"/>
  <path d="M512 240 L684 360 L684 664 L512 784 L340 664 L340 360 Z" fill="none" stroke="${t.color}" stroke-width="14" stroke-linejoin="round"/>
  <path d="M512 320 L612 396 L612 628 L512 704 L412 628 L412 396 Z" fill="${t.color}" fill-opacity="0.18" stroke="${t.color}" stroke-width="4" stroke-linejoin="round"/>
  <text x="512" y="540" text-anchor="middle" font-family="'Arial Black','Arial',sans-serif" font-size="120" font-weight="900" fill="#ffffff">${t.title}</text>
  <text x="512" y="610" text-anchor="middle" font-family="'Courier New',monospace" font-size="40" letter-spacing="10" fill="${t.color}">${t.sub}</text>
  <line x1="262" y1="652" x2="762" y2="652" stroke="#ffffff" stroke-opacity="0.15" stroke-width="2"/>
  <text x="512" y="712" text-anchor="middle" font-family="'Courier New',monospace" font-size="34" fill="#e2e8f0">1 CINA = 1000 MCINA = 1,000,000 UCINA</text>
  <text x="512" y="790" text-anchor="middle" font-family="'Courier New',monospace" font-size="28" fill="#94a3b8">CinaMega · TokenType ${t.tokenId} · Cinachain</text>
</svg>`
}

const desc = {
  ucina: "UCINA — the base unit of the CinaMega collection. Free to mint, unlimited supply, and the entry point to the Cina economy. Exchange 1,000,000 UCINA for 1 CINA.",
  mcina: "MCINA — the mid unit of the CinaMega collection. 1 MCINA = 1,000 UCINA. Obtained only by exchanging up from UCINA. 1,000 MCINA = 1 CINA.",
  cina: "CINA — the flagship unit of the CinaMega collection. 1 CINA = 1,000 MCINA = 1,000,000 UCINA. Obtained only by exchanging up through the Cina economy.",
}

const rateAttr = {
  ucina: "1 UCINA = 1 unit",
  mcina: "1 MCINA = 1,000 UCINA",
  cina: "1 CINA = 1,000,000 UCINA",
}

for (const t of TYPES) {
  writeFileSync(resolve(OUT, `${t.name}.svg`), svg(t))
  const meta = {
    name: `${t.title} — CinaMega #${t.tokenId}`,
    description: desc[t.name],
    image: `ipfs://__CID__/${t.name}.svg`,
    external_url: "https://nft.cinachain.com/collections",
    attributes: [
      { trait_type: "Collection", value: "CinaMega" },
      { trait_type: "TokenType", value: String(t.tokenId) },
      { trait_type: "Exchange Rate", value: rateAttr[t.name] },
      { trait_type: "Supply", value: "Unlimited (billions)" },
    ],
  }
  writeFileSync(resolve(OUT, `${t.name}.metadata.json`), JSON.stringify(meta, null, 2))
  console.log(`   ✓ ${t.name}.svg + ${t.name}.metadata.json`)
}

// Helper for the upload script: metadata template with placeholder.
writeFileSync(
  resolve(OUT, "README.md"),
  `# CinaMega assets

- ucina.svg / mcina.svg / cina.svg — template cards (on-chain SVG fallback).
- *.metadata.json — EIP-1155 metadata; __CID__ placeholder is replaced by
  upload-mega-assets.mjs with the real 4EVERLAND directory CID.
- cids.json — produced by upload-mega-assets.mjs: { ucina, mcina, cina }.

Keep this directory as the offline backup (Attachment-2 requirement).
`
)
console.log("✅ Assets written to mega-assets/")
