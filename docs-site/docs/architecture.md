---
sidebar_position: 2
---

# Architecture

```
Users / Wallets (EOA · Reown Smart Account · Coinbase Smart Wallet)
        │
        ▼
nft.cinachain.com  (Cloudflare Pages — Next.js static export)
        │
        ├── /api/auth/*          → auth.cinaseek.ai  (CinaAuth SSO proxy worker)
        ├── rpc / ipfs / cdn / meta .cinachain.com   (Cloudflare Web3 gateways)
        ├── whitelist-api.cinachain.com              (whitelist verification)
        ├── billing-api.cinachain.com                (metering + credits)
        ├── paymaster-api.cinachain.com              (gasless mint proxy)
        └── media.cinachain.com                      (CinaMega media: R2 → 4EVERLAND → on-chain)
```

## Contracts (Base Sepolia)

2026-08-22 contract set (OpenZeppelin 5.6.0, owner `0xa1fBED…6060`; sources
verified on Basescan):

| Contract | Standard | Address | Purpose |
|---|---|---|---|
| CinaNFT | ERC-721 | `0xbd0557a0...` | Main NFT collection |
| CinaBadge | ERC-1155 | `0x0a32fc13...` | Badges: spend tiers 100-104, contributor tiers 105-108 |
| CinaCredit | ERC-20 | `0x03a5637a...` | Billing credits (see semantics below) |
| CinaMega | ERC-1155 | `0x335e9569...` | Mega-collections + exchange |

## CinaCredit Semantics (single-token circular economy)

CinaCredit is **one token serving both sides of the cina economy**:

- **Prepaid metering (cinachain)** — the on-chain balance is the *ceiling*
  for API billing: usage is metered server-side by the billing worker and
  burns down the on-chain balance; top-ups (`mintWithEth`) mint directly.
- **Earnings settlement (cinatoken)** — marketplace withdrawals mint
  CINA-C to the contributor's wallet as final settlement.

Users can spend earned CINA-C on API usage and top up to contribute —
prepaid credits and settled earnings are fully fungible on-chain. **Product
surfaces must disclose that an on-chain balance can be consumed by API
usage**; internal ledgers (billing worker / gateway database) remain the
per-source accounting records. Decided 2026-08; revisit only if accounting
separation becomes necessary before a Base-mainnet launch.

## Wallet Layer

Reown AppKit 1.8 (wagmi 3 / viem 2) with three account paths:

- **EOA** (MetaMask / WalletConnect): plain transactions, user pays gas
- **Coinbase Smart Wallet**: EIP-5792 `sendCalls` + paymaster capability (gasless)
- **Reown Smart Account** (email/social): UserOps routed through the Reown cloud iframe (gasless)

SIWE verification supports EOA, EIP-1271 and EIP-6492 (smart accounts) via `viem/actions verifyMessage`.

## Sign-In

Site sign-in uses **CinaAuth SSO** (`accounts.cinaseek.ai`) — OpenID Connect
Authorization Code + PKCE against `auth.cinaseek.ai`, with the browser-side
OIDC calls forwarded through a same-origin Cloudflare Worker at
`nft.cinachain.com/api/auth/*` (the provider only allows first-party CORS
origins). The session (tokens + userinfo) is persisted client-side and
refreshed via refresh tokens. Wallet connection is independent of sign-in
and is only required for on-chain actions; SIWE signatures remain in two
places: the `/integration/sign-in-with-ethereum` demo and the `/settings`
API key binding verified server-side by the billing worker.

## Storage

CinaMega assets follow a four-layer fallback: **R2 → 4EVERLAND gateway → on-chain SVG → 503**.
Template SVGs + immutable IPFS CIDs are stored on-chain (locked permanently after initialization).
