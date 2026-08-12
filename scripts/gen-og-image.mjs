// Generates the portal's PNG assets with zero dependencies (manual PNG
// encoding via node:zlib + a 5×7 bitmap font):
//   portal/public/og-image.png        1200×630 social card (brand mesh + wordmark)
//   portal/public/apple-touch-icon.png   180×180 iOS home-screen icon
//   portal/public/icon-192.png / icon-512.png  PWA manifest icons
// Outputs go to portal/public/ (Vite's static dir) so they are served from
// the site root. Run in CI before the portal Pages deploy so assets always
// match the brand.
import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "portal", "public")

// ── 5×7 bitmap font (uppercase + digits) ──────────────────────────────
const FONT = {
  A: [".XXX.","X...X","X...X","XXXXX","X...X","X...X","X...X"],
  B: ["XXXX.","X...X","X...X","XXXX.","X...X","X...X","XXXX."],
  C: [".XXX.","X...X","X....","X....","X....","X...X",".XXX."],
  D: ["XXXX.","X...X","X...X","X...X","X...X","X...X","XXXX."],
  E: ["XXXXX","X....","X....","XXXX.","X....","X....","XXXXX"],
  F: ["XXXXX","X....","X....","XXXX.","X....","X....","X...."],
  G: [".XXX.","X...X","X....","X.XXX","X...X","X...X",".XXXX"],
  H: ["X...X","X...X","X...X","XXXXX","X...X","X...X","X...X"],
  I: [".XXX.","..X..","..X..","..X..","..X..","..X..",".XXX."],
  J: ["..XXX","...X.","...X.","...X.","X..X.","X..X.",".XX.."],
  K: ["X...X","X..X.","X.X..","XX...","X.X..","X..X.","X...X"],
  L: ["X....","X....","X....","X....","X....","X....","XXXXX"],
  M: ["X...X","XX.XX","X.X.X","X.X.X","X...X","X...X","X...X"],
  N: ["X...X","XX..X","X.X.X","X..XX","X...X","X...X","X...X"],
  O: [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
  P: ["XXXX.","X...X","X...X","XXXX.","X....","X....","X...."],
  Q: [".XXX.","X...X","X...X","X...X","X.X.X","X..X.",".XX.X"],
  R: ["XXXX.","X...X","X...X","XXXX.","X.X..","X..X.","X...X"],
  S: [".XXXX","X....","X....",".XXX.","....X","....X","XXXX."],
  T: ["XXXXX","..X..","..X..","..X..","..X..","..X..","..X.."],
  U: ["X...X","X...X","X...X","X...X","X...X","X...X",".XXX."],
  V: ["X...X","X...X","X...X","X...X","X...X",".X.X.","..X.."],
  W: ["X...X","X...X","X...X","X.X.X","X.X.X","XX.XX","X...X"],
  X: ["X...X","X...X",".X.X.","..X..",".X.X.","X...X","X...X"],
  Y: ["X...X","X...X",".X.X.","..X..","..X..","..X..","..X.."],
  Z: ["XXXXX","....X","...X.","..X..",".X...","X....","XXXXX"],
  "0": [".XXX.","X...X","X..XX","X.X.X","XX..X","X...X",".XXX."],
  "1": ["..X..",".XX..","..X..","..X..","..X..","..X..",".XXX."],
  "2": [".XXX.","X...X","....X","...X.","..X..",".X...","XXXXX"],
  "3": [".XXX.","X...X","....X","..XX.","....X","X...X",".XXX."],
  "4": ["....X","...X.","..XX.","X.X.X","XXXXX","....X","....X"],
  "5": ["XXXXX","X....","XXXX.","....X","....X","X...X",".XXX."],
  "6": ["..XX.",".X...","X....","XXXX.","X...X","X...X",".XXX."],
  "7": ["XXXXX","....X","...X.","..X..",".X...",".X...",".X..."],
  "8": [".XXX.","X...X","X...X",".XXX.","X...X","X...X",".XXX."],
  "9": [".XXX.","X...X","X...X",".XXXX","....X","...X.",".XX.."],
  " ": [".....",".....",".....",".....",".....",".....","....."],
  ".": [".....",".....",".....",".....",".....","..XX.","..XX."],
  "-": [".....",".....",".....",".XXX.",".....",".....","....."],
}

const GLYPH_W = 5
const GLYPH_H = 7

// ── Minimal PNG encoder ───────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(rgb, width, height) {
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3)
    raw[rowStart] = 0 // filter: none
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// ── Drawing helpers ───────────────────────────────────────────────────
function canvas(w, h, [r, g, b]) {
  const px = new Uint8Array(w * h * 3)
  for (let i = 0; i < w * h; i++) { px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b }
  return { px, w, h }
}

function blend(c, x, y, r, g, b, a) {
  const { px, w, h } = c
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return
  if (a >= 1) { const i = (y * w + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; return }
  const i = (y * w + x) * 3
  px[i] = Math.round(r * a + px[i] * (1 - a))
  px[i + 1] = Math.round(g * a + px[i + 1] * (1 - a))
  px[i + 2] = Math.round(b * a + px[i + 2] * (1 - a))
}

// Brand mesh stops (DESIGN.md develop → preview → ship pairs).
const STOPS = [
  [0x00, 0x7c, 0xf0],
  [0x00, 0xdf, 0xd8],
  [0x79, 0x28, 0xca],
  [0xff, 0x00, 0x80],
  [0xff, 0x4d, 0x4d],
  [0xf9, 0xcb, 0x28],
]
function stopAt(t) {
  const s = Math.max(0, Math.min(0.9999, t)) * (STOPS.length - 1)
  const i = Math.floor(s)
  const f = s - i
  const a = STOPS[i], b = STOPS[i + 1]
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]
}

// ── Text rendering ────────────────────────────────────────────────────
function textWidth(str, scale) {
  let w = 0
  for (const ch of str) {
    w += (ch === " " ? 3 : GLYPH_W) * scale + scale * 0.8
  }
  return Math.max(0, w - scale * 0.8)
}

function drawText(c, str, cx, cy, scale, color) {
  let x = cx - textWidth(str, scale) / 2
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "]
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (g[gy][gx] === "X") {
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++)
              blend(c, x + gx * scale + sx, cy + gy * scale + sy, color[0], color[1], color[2], 1)
        }
      }
    }
    x += (ch === " " ? 3 : GLYPH_W) * scale + scale * 0.8
  }
}

// ── Brand mark (matches portal/favicon.svg geometry, 64-unit space) ────
// Octagon (20,14)→(44,50), cyan stroke 3 units, inner circle r=10 at (32,32).
function pointInOctagon(x, y) {
  // Octagon vertices in order; ray-cast point-in-polygon.
  const v = [[20, 14], [44, 14], [50, 20], [50, 44], [44, 50], [20, 50], [14, 44], [14, 20]]
  let inside = false
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const [xi, yi] = v[i], [xj, yj] = v[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Render the favicon mark centered in a size×size square on a dark bg. */
function drawMark(size) {
  const c = canvas(size, size, [0x06, 0x0a, 0x12]) // #060a12
  const s = size / 64 // 64-unit favicon space → pixels
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ux = x / s, uy = y / s // back into 64-space
      const dEdge = distToOctagon(ux, uy)
      if (dEdge <= 1.5) { // 3-unit stroke ≈ 1.5 half-width
        blend(c, x, y, 0x50, 0xe3, 0xc2, 1)
      } else if (Math.hypot(ux - 32, uy - 32) <= 10) {
        blend(c, x, y, 0x50, 0xe3, 0xc2, 1)
      }
    }
  }
  return c
}

/** Approximate distance from point to octagon boundary (for the stroke). */
function distToOctagon(x, y) {
  // Signed distance via edge sampling: |dist to nearest edge| — sample the
  // 8 edges and take the min of (distance to segment) with sign by inside.
  const v = [[20, 14], [44, 14], [50, 20], [50, 44], [44, 50], [20, 50], [14, 44], [14, 20]]
  const inside = pointInOctagon(x, y)
  let min = Infinity
  for (let i = 0; i < v.length; i++) {
    const [x1, y1] = v[i], [x2, y2] = v[(i + 1) % v.length]
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2))
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
    if (d < min) min = d
  }
  return inside ? -min : min
}

// ── Social card (1200×630) ────────────────────────────────────────────
function drawOgImage() {
  const W = 1200, H = 630
  const c = canvas(W, H, [0x06, 0x0a, 0x12])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x + y * 1.4) / (W + H)
      const depth = 1 - Math.max(0, (y - H * 0.2) / (H * 0.55))
      if (depth > 0) {
        const [r, g, b] = stopAt(t)
        blend(c, x, y, r, g, b, 0.16 * Math.min(1, depth))
      }
    }
  }
  // Subtle cyan glow line under the headline area.
  for (let x = 0; x < W; x++)
    for (let dy = 0; dy < 3; dy++) blend(c, x, 400 + dy, 0x50, 0xe3, 0xc2, 0.10 - dy * 0.03)

  drawText(c, "CINACHAIN", W / 2, 180, 11, [0xff, 0xff, 0xff])
  drawText(c, "BUILT ON BASE L2", W / 2, 330, 5, [0x50, 0xe3, 0xc2])
  const barW = 300, barH = 10, barY = 305
  for (let y = barY; y < barY + barH; y++)
    for (let x = (W - barW) / 2; x < (W + barW) / 2; x++) blend(c, x, y, 0x50, 0xe3, 0xc2, 1)
  drawText(c, "CINAGROUP", W / 2, 470, 3, [0x64, 0x74, 0x8b])
  return c
}

// ── Write assets ──────────────────────────────────────────────────────
function writePng(name, c) {
  const out = join(OUT_DIR, name)
  const png = encodePng(Buffer.from(c.px.buffer, c.px.byteOffset, c.px.byteLength), c.w, c.h)
  writeFileSync(out, png)
  console.log(`wrote ${out} (${c.w}x${c.h}, ${(png.length / 1024).toFixed(1)} KiB)`)
}

writePng("og-image.png", drawOgImage())
writePng("apple-touch-icon.png", drawMark(180))
writePng("icon-192.png", drawMark(192))
writePng("icon-512.png", drawMark(512))
