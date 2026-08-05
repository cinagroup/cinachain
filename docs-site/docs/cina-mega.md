---
sidebar_position: 5
---

# CinaMega Mega-Collections

Three template-based ERC-1155 mega-collections with billions of possible copies
each, linked by a fixed bidirectional exchange.

| Type | Units | How to obtain |
|---|---|---|
| UCINA (1) | 1 | Free public mint (1,000,000/address cap) |
| MCINA (2) | 1,000 | Exchange only |
| CINA (3) | 1,000,000 | Exchange only |

**Rate**: `1 CINA = 1,000 MCINA = 1,000,000 UCINA`

## Exchange

`exchange(fromType, toType, amount)` — atomic burn + mint:
`toAmount = amount × units[from] / units[to]` (floor; dust burned on the source side).

## Storage (four-layer fallback)

`R2 → 4EVERLAND gateway → on-chain getBackupSvgRaw (5 QPS) → 503`

Template SVGs and immutable IPFS CIDs are written to the contract and
**permanently locked** (`svgLocked = true`) — metadata trust base cannot change.

## Design

See [`docs/superpowers/specs/2026-08-05-cina-mega-design.md`](https://github.com/cinagroup/cinachain/blob/main/docs/superpowers/specs/2026-08-05-cina-mega-design.md)
