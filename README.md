# CinaChain

![TypeScript](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

CinaChain is a Web3 collection platform currently configured for a **Base Sepolia Testnet / Beta** release. The repository contains the public brand portal, NFT DApp, documentation site, smart contracts, and Cloudflare edge services.

> Beta uses testnet assets only. Repository configuration describes the intended release topology; it does not by itself prove that a custom domain or Worker is currently deployed.

## Product surfaces

| Surface       | Intended URL                                     | Cloudflare unit                   |
| ------------- | ------------------------------------------------ | --------------------------------- |
| Brand portal  | [cinachain.com](https://cinachain.com)           | Pages project `cinachain-portal`  |
| NFT DApp      | [nft.cinachain.com](https://nft.cinachain.com)   | Pages project `cinachain-dapp-v2` |
| Documentation | [docs.cinachain.com](https://docs.cinachain.com) | Pages project `cinachain-docs`    |

Custom-domain bindings and the live revision must be verified in the Cloudflare dashboard after each release.

## Features

- **NFT Gallery** — Browse collection with multi-gateway IPFS image fallback
- **Minting** — Whitelist (Merkle Tree) + Public phase support
- **Wallet connection** — Reown AppKit with wagmi and viem
- **Base Sepolia** — one explicit testnet network and BaseScan explorer links
- **Cloudflare edge** — Pages frontends plus independently deployed Workers
- **Admin Dashboard** — Whitelist management, contract operations

## Quick Start

```bash
npm ci --legacy-peer-deps
npm run dev
```

The local DApp is available at `http://localhost:3000`. Copy `.env.example` to `.env.local` and replace placeholder public values before testing contract flows. Never place server credentials in `NEXT_PUBLIC_*` variables.

## Quality gates

```bash
npm run design:tokens:check
npm run security:config
npm run typecheck
npx tsc -p workers/rpc-proxy/tsconfig.json --pretty false
npm run lint
npm test
npm run build
```

These checks run before the Pages and Worker jobs in `.github/workflows/deploy.yml`. A push to `main` is only a deployment trigger; release success still requires green checks, valid Cloudflare credentials, required Worker secret bindings, and post-deploy verification.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the release order, security gates, and manual commands.

## Tech Stack

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Frontend       | Next.js 14, React 18, TypeScript, TailwindCSS |
| Web3           | wagmi, viem, Reown AppKit, Base Sepolia       |
| Infrastructure | Cloudflare Pages, Workers, KV, R2             |
| Storage        | IPFS gateways and Cloudflare R2               |

## Documentation

- [Phase 1 Design Spec](docs/superpowers/specs/2026-06-20-cinachain-production-deployment-design.md)
- [Deployment Verification Guide](docs/phase1-verification.md)
- [Release Guide](DEPLOYMENT.md)

## Environment Variables

See `.env.example` for local placeholders and `.env.production` for tracked public build configuration. Encrypted Worker values are provisioned through Cloudflare secrets and must not be committed.

Copyright 2026 cinagroup
