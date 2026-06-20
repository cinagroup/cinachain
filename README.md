# 🔗 CinaChain NFT DApp

![TypeScript](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](http://perso.crans.org/besson/LICENSE.html)

CinaChain NFT Platform — built on Ethereum with Cloudflare Web3 infrastructure (Pages + Workers + IPFS Gateway + RPC Gateway).

## Features

- **NFT Gallery** — Browse collection with multi-gateway IPFS image fallback
- **Minting** — Whitelist (Merkle Tree) + Public phase support
- **Wallet Connect** — RainbowKit with MetaMask, WalletConnect, Coinbase
- **Cloudflare Web3** — Edge-deployed IPFS & RPC gateways
- **Admin Dashboard** — Whitelist management, contract operations

## Quick Start

```bash
pnpm install
pnpm dev
```

## Deploy to Cloudflare Pages

```bash
# Build for Cloudflare Pages
pnpm pages:build

# Preview locally
pnpm pages:preview

# Deploy
pnpm pages:deploy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Web3 | wagmi v2, viem, RainbowKit |
| Infrastructure | Cloudflare Pages, Workers, KV, IPFS Gateway |
| Storage | NFT.Storage (IPFS), Cloudflare R2 (backup) |

## Documentation

- [Phase 1 Design Spec](docs/superpowers/specs/2026-06-20-cinachain-production-deployment-design.md)
- [Deployment Verification Guide](docs/phase1-verification.md)

## Environment Variables

See `.env.example` for required environment variables.

Copyright 2026 cinagroup
