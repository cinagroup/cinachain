---
sidebar_position: 1
---

# CinaChain Docs

A full-stack Web3 ecosystem on **Base Sepolia Testnet** — NFT platform, badge system, mega-collections, and edge-deployed infrastructure on Cloudflare.

## Products

| Product | Standard | What it is |
|---|---|---|
| [CinaChain NFT](https://nft.cinachain.com/explore) | ERC-721 | 10,000 unique collectibles, whitelist + public mint |
| [CinaBadge](https://nft.cinachain.com/dashboard/badges) | ERC-1155 | Soulbound achievements, tickets, membership tiers |
| [CinaMega](https://nft.cinachain.com/collections) | ERC-1155 | UCINA / MCINA / CINA mega-collections with fixed 1:1000:1,000,000 exchange |
| [Edge API](https://whitelist-api.cinachain.com/health) | Workers | Whitelist, billing metering, media gateway on Cloudflare's edge |

## Key Facts

- **Network**: Base Sepolia (testnet) — contracts on `0x3443febc...` (CinaMega)
- **DApp**: https://nft.cinachain.com
- **Media gateway**: https://media.cinachain.com (R2 → 4EVERLAND → on-chain SVG fallback)
- **GitHub**: https://github.com/cinagroup/cinachain

## Quick Start (local dev)

```bash
npm install
cp .env.example .env.local   # fill NEXT_PUBLIC_* values
npm run dev                  # http://localhost:3000
```

## Guides

- [Architecture](./architecture)
- [Domain Configuration](./domains)
- [Deployment](./deployment)
- [CinaMega Mega-Collections](./cina-mega)
