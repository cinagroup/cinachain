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

Use the manual `deploy-contracts` GitHub Actions workflow so the deployment
key remains in the repository secret store and never appears in shell history.
For local Foundry operations, import an encrypted keystore with
`cast wallet import cinachain-deployer --interactive` and use `--account`.

## Env

Public values in `.env.production` may be committed. Secrets
(`DEPLOY_PRIVATE_KEY`, `CLOUDFLARE_API_TOKEN`, `ADMIN_KEY`,
`INGRESS_ENC_KEY`) must stay out of the repository, shell arguments, and logs.

Billing binds account-level Cloudflare Secrets Store entries from store
`346e2b4b86334bc29083c064116e91cf`:

| Worker binding    | Versioned Secrets Store name           |
| ----------------- | -------------------------------------- |
| `ADMIN_KEY`       | `CINACHAIN_BILLING_ADMIN_KEY_V1`       |
| `INGRESS_ENC_KEY` | `CINACHAIN_BILLING_INGRESS_ENC_KEY_V1` |

Both entries must be `active` and include the `workers` scope. Provision
missing entries from process environment variables through stdin:

```bash
npm --prefix workers/billing ci --ignore-scripts
npm run secrets:billing
npm run secrets:billing:check
```

The script uses the locked Wrangler 4.101 CLI and an explicit production
`--remote` operation. It rejects short or placeholder values, scrubs both
values from the child environment, and never uses `--value` or puts a value in
the argument list. Existing active V1 entries are skipped; an existing V1 with
the wrong status or scope fails without being overwritten.

Cloudflare Secrets Store is currently open beta. The CI deployment token needs
**Account Secrets Store Edit** in addition to its Worker deployment permissions:
Read can list metadata, but cannot deploy a Worker binding. The verification
command checks each remote entry's name, `active` status, and `workers` scope.

Local development also requires Secrets Store binding objects; plaintext
`ADMIN_KEY` / `INGRESS_ENC_KEY` strings in `.dev.vars` cannot replace the
asynchronous `get()` interface. From `workers/billing`, create the same local
store ID/name pairs without `--remote` or `--value`, then start `wrangler dev`:

```bash
./node_modules/.bin/wrangler secrets-store secret create 346e2b4b86334bc29083c064116e91cf --name CINACHAIN_BILLING_ADMIN_KEY_V1 --scopes workers
./node_modules/.bin/wrangler secrets-store secret create 346e2b4b86334bc29083c064116e91cf --name CINACHAIN_BILLING_INGRESS_ENC_KEY_V1 --scopes workers
./node_modules/.bin/wrangler dev
```

Enter both values interactively. Wrangler persists this local state under the
ignored `workers/billing/.wrangler/`; local entries do not change production.

## Operator notes

- Save the new `ADMIN_KEY` in an approved password manager before creation;
  it must contain at least 32 characters and no whitespace. Secrets Store does
  not expose its plaintext after saving.
- Rotate by introducing a V2 name and updating the Worker binding. Never
  overwrite an immutable V1 entry through a non-interactive CLI flow.
- Verify the old admin credential is rejected and the new credential succeeds.
- `INGRESS_ENC_KEY` must be 32 random bytes encoded as 64 hexadecimal characters.
- Re-encrypt or invalidate ciphertext created with the former ingress key.
- Confirm both entries are active and Workers-scoped with
  `npm run secrets:billing:check` before deployment.
- 4EVERLAND pinning: `FOUR_EVERLAND_TOKEN=... node scripts/upload-mega-assets.mjs`
  (CIDs are content-addressed — identical to the values already locked on-chain)
