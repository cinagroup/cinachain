---
sidebar_position: 4
---

# Deployment

CI (`deploy.yml`) deploys on push to `main`:

1. **Cloudflare Pages** `cinachain-dapp-v2` (Next.js static export → `out/`)
2. **Billing worker** `cinachain-billing` (wrangler deploy)
3. **Media gateway worker** `cinachain-mega-media` (wrangler deploy; its R2 bucket must already exist)
4. **Portal** `cinachain-portal` (static `portal/index.html`)

## Contracts (manual, Base Sepolia)

```bash
DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-mega.mjs              # CinaMega
CINA_MEGA_CONTRACT=0x... node scripts/init-mega-templates.mjs      # templates + lock (irreversible)
CINA_MEGA_CONTRACT=0x... node scripts/test-mega.mjs                # on-chain verification
```

## Env

Public values in `.env.production` may be committed. Secrets
(`DEPLOY_PRIVATE_KEY`, `CLOUDFLARE_API_TOKEN`, `ADMIN_KEY`,
`INGRESS_ENC_KEY`) must stay out of the repository, shell arguments, and logs.

Billing declares `ADMIN_KEY` and `INGRESS_ENC_KEY` in
`workers/billing/wrangler.toml` as required encrypted bindings. Provision them
from process environment variables through stdin:

```bash
npm --prefix workers/billing ci --ignore-scripts
npm run secrets:billing
npm run secrets:billing:check
```

The provisioning script rejects short or placeholder values and never adds a
secret value to the Wrangler argument list. Local Worker development uses an
untracked `workers/billing/.dev.vars` file. Do not combine `.dev.vars` and
`.env` for the same Worker.

## Operator notes

- Rotate the previously tracked `ADMIN_KEY` before the next production deploy.
- Verify the old admin credential is rejected and the new credential succeeds.
- `INGRESS_ENC_KEY` must be 32 random bytes encoded as 64 hexadecimal characters.
- Re-encrypt or invalidate ciphertext created with the former ingress key.
- Confirm both names with `npm run secrets:billing:check` before deployment.
- 4EVERLAND pinning: `FOUR_EVERLAND_TOKEN=... node scripts/upload-mega-assets.mjs`
  (CIDs are content-addressed — identical to the values already locked on-chain)
