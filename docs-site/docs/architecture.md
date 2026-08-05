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
        ├── rpc / ipfs / cdn / meta .cinachain.com   (Cloudflare Web3 gateways)
        ├── whitelist-api.cinachain.com              (whitelist verification)
        ├── billing-api.cinachain.com                (metering + credits)
        ├── paymaster-api.cinachain.com              (gasless mint proxy)
        └── media.cinachain.com                      (CinaMega media: R2 → 4EVERLAND → on-chain)
```

## Contracts (Base Sepolia)

| Contract | Standard | Address | Purpose |
|---|---|---|---|
| CinaNFT | ERC-721 | `0x9178c3dd...` | Main NFT collection |
| CinaBadge | ERC-1155 | `0x72cc9adb...` | Badges / tiers |
| CinaCredit | ERC-20 | `0x78f5aebc...` | Billing credits |
| CinaMega | ERC-1155 | `0x3443febc...` | Mega-collections + exchange |

## Wallet Layer

Reown AppKit 1.8 (wagmi 3 / viem 2) with three account paths:

- **EOA** (MetaMask / WalletConnect): plain transactions, user pays gas
- **Coinbase Smart Wallet**: EIP-5792 `sendCalls` + paymaster capability (gasless)
- **Reown Smart Account** (email/social): UserOps routed through the Reown cloud iframe (gasless)

SIWE verification supports EOA, EIP-1271 and EIP-6492 (smart accounts) via `viem/actions verifyMessage`.

## Storage

CinaMega assets follow a four-layer fallback: **R2 → 4EVERLAND gateway → on-chain SVG → 503**.
Template SVGs + immutable IPFS CIDs are stored on-chain (locked permanently after initialization).
