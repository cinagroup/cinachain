# DApp RPC Configuration

How the CinaChain DApp (`nft.cinachain.com`) reaches Base Sepolia, and how to
operate the RPC layer reliably.

## Overview

The browser never calls Alchemy directly. All RPC traffic flows through a
self-hosted **rpc-proxy Worker** at `base-rpc.cinachain.com`, which proxies
**Alchemy** server-side (key held as a Worker secret) with two public endpoints
as availability fallback.

```
browser → base-rpc.cinachain.com (rpc-proxy Worker)
                 ├─ https://base-sepolia.g.alchemy.com/v2/<key>  (primary)
                 ├─ https://sepolia.base.org                     (fallback)
                 └─ https://base-sepolia.publicnode.com          (fallback)
```

This architecture fixes the two failure modes that broke direct browser calls:

- **CORS / referrer-allowlist errors.** Alchemy returns no
  `Access-Control-Allow-Origin` header when it rejects a request (invalid key,
  allowlist mismatch, quota) — every rejection surfaced in the browser as a
  generic CORS error that hid the real cause. The Worker's server-side `fetch`
  bypasses browser CORS entirely.
- **Key leakage.** The Alchemy key used to be baked into the frontend bundle
  (it leaked repeatedly via CSP echoes and chat). It now lives only in the
  Worker's encrypted secret.

## Configuration

| File | Role |
|---|---|
| `config/networks.ts` | `fallback([worker?, base.org, publicnode], { rank: false })`. The Worker (`NEXT_PUBLIC_BASE_RPC`) is prepended when set; public endpoints let the app load even without the Worker (local dev, CI, a deploy in flight). |
| `env.mjs` | `NEXT_PUBLIC_BASE_RPC` (the Worker URL) in the client schema + `runtimeEnv`. |
| `.env.production` | `NEXT_PUBLIC_BASE_RPC=https://base-rpc.cinachain.com` (committed; it is a public URL). |
| `workers/rpc-proxy/` | The Worker. `src/index.ts` proxies Alchemy + public fallback; `wrangler.toml` binds `base-rpc.cinachain.com` as a custom domain. |
| `.github/workflows/deploy.yml` | The `workers` job deploys the Worker and injects the Alchemy key via `wrangler secret put ALCHEMY_API_KEY` (piped from the `NEXT_PUBLIC_ALCHEMY_API_KEY` GitHub Secret — the name is reused, but the value is now server-only). |

The DApp no longer references `NEXT_PUBLIC_ALCHEMY_API_KEY`; the GitHub secret
of that name is consumed only by the Worker deploy step.

## Enabling / rotating the Alchemy key

1. Register at [alchemy.com](https://www.alchemy.com/) → create an app →
   **Base Sepolia** → copy the API key.
2. GitHub repo → **Settings → Secrets and variables → Actions** → set
   `NEXT_PUBLIC_ALCHEMY_API_KEY` = the key. (Name kept for continuity; the value
   is now a **Worker secret**, not a frontend var.)
3. Push to `main`. The `workers` job redeploys rpc-proxy and re-seals the key
   into its secret.

Rotation is the same flow — update the GitHub secret and push. **No browser
referrer allowlist is needed anymore**: the Worker's server-side fetch carries
no browser `Origin`/`Referer`, and its own endpoint is constrained by the CORS
`Origin` allow-list in `src/index.ts`.

## Verification

- **Worker live**:
  ```
  curl -s -X POST https://base-rpc.cinachain.com \
    -H "Content-Type: application/json" -H "Origin: https://nft.cinachain.com" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
  ```
  → `{"jsonrpc":"2.0","id":1,"result":"0x14a34"}` (Base Sepolia = 84532).
- **DApp uses the Worker**: open `https://nft.cinachain.com` (incognito, to
  bypass the ServiceWorker) → DevTools → Network → RPC requests go to
  `base-rpc.cinachain.com`, **never** to `*.g.alchemy.com`. No CORS errors.
- **Bundle clean**: scan the live JS chunks for `alchemy` — the key must not
  appear anywhere in the frontend.

## Troubleshooting

1. **All requests fall back to public nodes** → `NEXT_PUBLIC_BASE_RPC` unset in
   `.env.production`, or the Worker deploy failed (check the `workers` job).
   Symptom: Network tab shows `sepolia.base.org`, not `base-rpc.cinachain.com`.
2. **`base-rpc.cinachain.com` returns 403** → the custom domain isn't bound.
   Confirm the `workers` job ran `wrangler deploy` and that the `cinachain.com`
   zone is in the same Cloudflare account as the API token.
3. **Worker returns 502 "All upstream RPCs failed"** → Alchemy key missing/invalid
   **and** both public endpoints also failed. Run `wrangler secret list` to
   confirm `ALCHEMY_API_KEY` is set; check the Alchemy dashboard for validity/quota.
4. **viem `fallback()` auto-ranks by latency** → `rank: false` is set so the
   Worker stays primary; don't re-enable ranking or public nodes may win.
5. **ServiceWorker caches the old bundle** → when verifying, unregister the SW
   and clear site data, or use an incognito window.

## Key safety

- The Alchemy key lives **only** in GitHub Secrets → Worker secret. It is never
  in git, `.env.production`, `wrangler.toml`, the frontend bundle, or chat.
- Browser abuse of the Worker endpoint is bounded by the CORS `Origin` allow-list
  in `src/index.ts` — only `nft.cinachain.com` (and localhost for dev) can call
  it from a browser. For stricter limits, add Cloudflare rate-limiting or an
  `X-RPC-Auth` token on the Worker (any value shipped to the browser is public,
  so Origin checks are the practical first line).
- Still set Alchemy dashboard **usage monitoring** + **rate caps** as defence in
  depth.

## Going to Base Mainnet

In `workers/rpc-proxy/src/index.ts`, change the Alchemy URL to
`https://base-mainnet.g.alchemy.com/v2/<key>` and the public fallbacks to
`https://mainnet.base.org` + a mainnet public node. In `config/deployment.ts`
swap `PRIMARY_CHAIN` to mainnet `base`; the `NEXT_PUBLIC_BASE_RPC` Worker URL
stays the same, and the Worker's CORS allow-list is unaffected.
