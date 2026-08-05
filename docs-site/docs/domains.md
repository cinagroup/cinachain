---
sidebar_position: 3
---

# Domain Configuration

Full plan and status: [`docs/domain-config-plan.md`](https://github.com/cinagroup/cinachain/blob/main/docs/domain-config-plan.md)

| Domain | Purpose | Target |
|---|---|---|
| `cinachain.com` / `www` | Brand portal | Pages `cinachain-portal` |
| `nft.cinachain.com` | DApp | Pages `cinachain-dapp-v2` |
| `docs.cinachain.com` | Docs (this site) | Pages `cinachain-docs` |
| `whitelist-api.cinachain.com` | Whitelist worker | `cinachain-whitelist-api` |
| `billing-api.cinachain.com` | Billing worker | `cinachain-billing` |
| `paymaster-api.cinachain.com` | Paymaster proxy | `cinachain-paymaster` |
| `media.cinachain.com` | Mega media gateway | `cinachain-mega-media` |
| `ipfs` / `cdn` / `meta` .cinachain.com | IPFS gateways | Cloudflare Web3 DNSLink |
| `rpc` / `mainnet-rpc` / `base-rpc` .cinachain.com | ETH RPC gateways | Cloudflare Web3 |

Service subdomains are bound via **zone worker routes** + proxied records.
CSP uses the `https://*.cinachain.com` wildcard so new services are covered automatically.
