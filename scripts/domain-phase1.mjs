// Phase 1: bind cinachain.com custom domains (Pages + workers) via Cloudflare API.
// Prereq: CLOUDFLARE_API_TOKEN (Pages Edit + Workers Scripts Edit + Zone DNS Edit)
// Usage: CLOUDFLARE_API_TOKEN=... node scripts/domain-phase1.mjs [--dry-run]
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "7ea8e46d8210bad342fa7595f7935fea"
const ZONE = "363c240a200996181b6192bdb03e7ce4"
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!TOKEN) throw new Error("CLOUDFLARE_API_TOKEN required")
const DRY = process.argv.includes("--dry-run")

const api = async (method, path, body) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function main() {
  // 1. Verify token + zone access
  const me = await api("GET", "/user/tokens/verify")
  console.log("token verify:", me.json?.success === true ? "OK" : JSON.stringify(me.json?.errors?.[0] ?? me.json))
  if (me.json?.success !== true) process.exit(1)

  // 2. Pages custom domain (nft.cinachain.com → cinachain-dapp-v2)
  const pages = await api("POST", `/accounts/${ACCOUNT}/pages/projects/cinachain-dapp-v2/domains`, { name: "nft.cinachain.com" })
  console.log("pages nft.cinachain.com:", pages.status, pages.json?.success === true ? "OK" : JSON.stringify(pages.json?.errors?.[0] ?? pages.json?.result))

  // 3. Worker custom domains (auto-creates DNS records in the zone)
  const workers = [
    { hostname: "whitelist-api.cinachain.com", service: "cinachain-whitelist-api" },
    { hostname: "billing-api.cinachain.com", service: "cinachain-billing" },
    { hostname: "paymaster-api.cinachain.com", service: "cinachain-paymaster" },
    { hostname: "media.cinachain.com", service: "cinachain-mega-media" },
  ]
  for (const w of workers) {
    if (DRY) { console.log("[dry-run] worker domain:", w.hostname, "→", w.service); continue }
    const r = await api("POST", `/accounts/${ACCOUNT}/workers/domains`, {
      hostname: w.hostname, service: w.service, environment: "production", zone_id: ZONE,
    })
    console.log(`worker ${w.hostname}:`, r.status, r.json?.success === true ? "OK" : JSON.stringify(r.json?.errors?.[0] ?? r.json?.result))
  }
}

main().catch((e) => { console.error("❌", e.message); process.exit(1) })
