---
sidebar_position: 4
---

# Deployment

CI (`deploy.yml`) deploys on push to `main`:

1. **Cloudflare Pages** `cinachain-dapp-v2` (Next.js static export → `out/`)
2. **Billing worker** `cinachain-billing` (wrangler deploy)
3. **Media gateway worker** `cinachain-mega-media` (wrangler deploy, R2 bucket auto-created)
4. **Portal** `cinachain-portal` (static `portal/index.html`)

## Contracts (manual, Base Sepolia)

```bash
DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-mega.mjs              # CinaMega
CINA_MEGA_CONTRACT=0x... node scripts/init-mega-templates.mjs      # templates + lock (irreversible)
CINA_MEGA_CONTRACT=0x... node scripts/test-mega.mjs                # on-chain verification
```

## Env

Public values in `.env.production` (committed); secrets (`DEPLOY_PRIVATE_KEY`,
`CLOUDFLARE_API_TOKEN`, `INGRESS_ENC_KEY`) stay out of the repo.

## Operator notes

- `INGRESS_ENC_KEY` (64-hex) required for the billing ingress channel
- 4EVERLAND pinning: `FOUR_EVERLAND_TOKEN=... node scripts/upload-mega-assets.mjs`
  (CIDs are content-addressed — identical to the values already locked on-chain)
