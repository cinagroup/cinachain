# DApp RPC Configuration

How the CinaChain DApp (`nft.cinachain.com`) reads on-chain data, and how to
provision/reliably operate the RPC layer.

## Overview

The DApp reads chain state (collection stats, balances, mint/badge state)
through a wagmi [`fallback`](https://wagmi.sh/react/api/transports/fallback)
transport chain. **Alchemy** (paid, when configured) is the primary RPC for
reliability + SLA; two public endpoints serve as failure fallbacks.

Priority order (strict — see `rank: false` below):

1. **Alchemy** `https://base-sepolia.g.alchemy.com/v2/<key>` — primary
2. **sepolia.base.org** — public fallback (CORS-open)
3. **base-sepolia.publicnode.com** — public fallback

## Configuration (4 coupled pieces)

| File | Role |
|---|---|
| `config/networks.ts` | `fallback([alchemy?, base.org, publicnode], { rank: false })`. Alchemy is only prepended when a key is present, so the app works without one. |
| `env.mjs` | `NEXT_PUBLIC_ALCHEMY_API_KEY` declared in the `@t3-oss/env` client schema + `runtimeEnv`. |
| `.github/workflows/deploy.yml` | The DApp `Build static export` step injects the key from GitHub Secrets at build time. |
| `public/_headers` | CSP `connect-src` **must** include `https://*.g.alchemy.com` (covers Base Sepolia now + Base Mainnet later). |

All four are required for Alchemy to actually be used at runtime — omit any one
and the browser silently falls back to the public nodes.

## Enabling Alchemy

1. Register at [alchemy.com](https://www.alchemy.com/) → create an app → pick
   **Base Sepolia** → copy the API key.
2. In the Alchemy dashboard, set the key's **Allowlist Domains** (referrer
   allowlist) to:
   ```
   nft.cinachain.com
   cinachain.com
   localhost
   ```
   Plain hosts only — **no `https://`, no path, no `www`**. Alchemy does not
   auto-include subdomains, so list each host explicitly.
3. GitHub repo → **Settings → Secrets and variables → Actions** →
   `NEXT_PUBLIC_ALCHEMY_API_KEY` = the key.
4. Push to `main` (or re-run the workflow). The key is inlined into the static
   export during `next build`.

Without a key, the app behaves exactly as before (public endpoints only).

## Verification

- **Bundle (key injected)**: scan the live JS chunks for `g.alchemy.com`.
- **Runtime (key accepted)**: open `https://nft.cinachain.com` in an
  **incognito window** → DevTools → Network → filter `alchemy` → the request
  should return **200**. Incognito avoids the stale ServiceWorker bundle.

## Troubleshooting — lessons learned

These are the failure modes hit while bringing up Alchemy; each looks like
"Alchemy isn't being used" but has a distinct cause.

1. **CSP blocks the request** → `public/_headers` `connect-src` missing
   `https://*.g.alchemy.com`. Symptom: `Content Security Policy violation`
   in console; wagmi falls back to a public node. CSP also echoes the blocked
   URL (incl. the key) into the console, so fix this before relying on a key.
2. **viem `fallback()` auto-ranks by latency** → default `rank: true` can
   deprioritise Alchemy in edge measurements. Set `{ rank: false }` for strict
   list-order priority (Alchemy first).
3. **The key is build-time only** → `NEXT_PUBLIC_*` is inlined at `next build`.
   The GitHub Secret must be set **before** the deploy run; rotating the key
   requires a rebuild (an empty commit + push is enough).
4. **Rotating a key** → revoke the old key in Alchemy **and** update the GitHub
   Secret to the new one (not just revoke). Until a fresh build ships, cached
   bundles still carry the old key and Alchemy will return 401 (which browsers
   surface as a CORS error because there's no CORS header on the 401).
5. **ServiceWorker caches the old bundle** → when verifying locally, unregister
   the SW and clear caches, or use an incognito window. The SW serves stale
   `_next/static/*` chunks otherwise.

## Key safety

- The key is necessarily public in the client bundle (a static DApp cannot hide
  it). Protection layers: Alchemy **referrer allowlist** + **usage monitoring**
  + **rate caps** in the Alchemy dashboard.
- The key lives **only** in GitHub Secrets — never in git, `.env.production`,
  or chat. If a key value leaks (e.g. a CSP violation prints it), rotate it.

## Going to Base Mainnet

When migrating off testnet, in `config/networks.ts` swap the chain + endpoints:
Alchemy URL becomes `https://base-mainnet.g.alchemy.com/v2/<key>` (already
covered by the `*.g.alchemy.com` CSP entry), and the two public fallbacks
become `https://mainnet.base.org` + a mainnet public node. Update the Alchemy
app's network + the referrer allowlist remains the same.
