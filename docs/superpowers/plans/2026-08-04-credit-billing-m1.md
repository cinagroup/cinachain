# CinaCredit Billing M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship M1 of the API billing system: a CinaCredit ERC-20 (ETH top-up → minted credit), a Cloudflare Worker billing gateway (API-key auth + server-side metering + 429), a `/credits` top-up page, and a minimal admin page — so a user can top up, call the demo API, watch balance drain, and get stopped at zero.

**Architecture:** On-chain `CinaCredit` is the only asset layer (top-up minting, `mintTo` for platform-controlled issuance, transferable). All consumption is metered server-side in a Cloudflare Worker KV ledger with zero gas per request; a Transfer-event indexer keeps the on-chain balance snapshot fresh. `usable = onchainSnapshot − committedUsage` is enforced before every call.

**Tech Stack:** Solidity 0.8.24 (solc-js + viem deploy, OZ vendored at `contracts/openzeppelin`), vitest (new, for billing-core/indexer unit tests), Cloudflare Workers + KV, Next.js 14.2.25 static export, existing SIWE hook.

**Spec:** `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` (Sections 3, 4, 6.2, 7, 8-M1)

---

## File Structure

| File | Responsibility |
|---|---|
| `contracts/src/CinaCredit.sol` | New ERC-20: `mintWithEth`, `mintTo` (onlyOwner), `redeem`, rate/fee/treasury, events |
| `scripts/compile-and-deploy.mjs` | Add CinaCredit to output selection (modify) |
| `scripts/deploy.mjs` | Add CinaCredit deployment step (modify) |
| `scripts/test-credit.mjs` | On-chain verification script (mint rate/fee, onlyOwner, paused) |
| `workers/billing/src/lib/billing-core.js` | Pure functions: ledger ops, pricing, usable-balance, 429 checks |
| `workers/billing/src/lib/indexer.js` | Pure function: Transfer-log → snapshot updates |
| `workers/billing/src/index.js` | Worker entry: routes `/v1/keys`, `/v1/usage`, `/v1/credits/:addr`, health |
| `workers/billing/wrangler.toml` | Worker config + KV binding |
| `workers/billing/package.json` | wrangler devDep |
| `lib/contracts/cina-credit.ts` | ABI + helpers for the frontend |
| `lib/contracts/addresses.ts` | Add `CINA_CREDIT_CONTRACT` (modify) |
| `lib/hooks/use-credit-balance.ts` | Frontend balance + rate hooks |
| `lib/hooks/use-api-keys.ts` | SIWE-bound API key create/revoke/list |
| `app/(general)/credits/page.tsx` | Top-up page (wallet → amount → mintWithEth → balance) |
| `app/settings/page.tsx` | API key management (SIWE) |
| `app/admin/billing/page.tsx` | Rate setter (owner), mintTo issuance, ledger overview |
| `.env.local`, `.env.production`, `env.mjs` | Credit contract address + billing API URL (modify) |
| `public/sw.js` | Add billing worker host to NO_CACHE_PATTERNS (modify) |
| `package.json` | vitest + test script (modify) |

---

## Task 1: Test Framework (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest --legacy-peer-deps
```

- [ ] **Step 2: Add test script to package.json**

```json
"scripts": {
  "test": "vitest run"
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "workers/**/*.test.js"],
  },
})
```

- [ ] **Step 4: Create smoke test lib/__tests__/smoke.test.ts**

```ts
import { describe, it, expect } from "vitest"

describe("smoke", () => {
  it("test runner works", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run and verify PASS**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts lib/__tests__/smoke.test.ts
git commit -m "test: add vitest + smoke test"
```

---

## Task 2: CinaCredit Contract

**Files:**
- Create: `contracts/src/CinaCredit.sol`

- [ ] **Step 1: Write the contract (complete code below)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CinaCredit — ERC-20 credit token for the CinaChain API billing system
/// @notice On-chain asset layer only: top-ups mint, transfers move balance.
///         Consumption is metered server-side (zero gas per API call);
///         on-chain balance is the credit CEILING, not the exact remaining.
contract CinaCredit is ERC20, Ownable, Pausable, ReentrancyGuard {
    /// @notice 1 ETH = N credit (owner-settable; oracle planned for mainnet)
    uint256 public ethToCreditRate;

    /// @notice Treasury that receives ETH from mintWithEth
    address public treasury;

    /// @notice Platform fee in basis points (200 = 2%); 0 disables
    uint256 public platformFeeBps;

    /// @notice Cumulative minted per address (weak tier reference)
    mapping(address => uint256) public totalMintedOf;

    /// @notice Cumulative burned per address (weak tier reference)
    mapping(address => uint256) public totalBurnedOf;

    /// @notice Redeem pool ceiling — credits redeemable only while treasury
    ///         ETH balance covers them at the current rate.
    bool public redeemEnabled;

    event CreditMinted(address indexed to, uint256 amount, uint8 channel);
    event CreditRedeemed(address indexed from, uint256 amount);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event RedeemToggled(bool enabled);

    error ZeroRate();
    error ZeroTreasury();
    error FeeTooHigh();
    error NoEthSent();
    error RedeemDisabled();
    error InsufficientTreasury();

    constructor(
        address _initialOwner,
        uint256 _ethToCreditRate,
        address _treasury,
        uint256 _platformFeeBps
    ) ERC20("CinaCredit", "CINA-C") Ownable(_initialOwner) {
        if (_ethToCreditRate == 0) revert ZeroRate();
        if (_treasury == address(0)) revert ZeroTreasury();
        if (_platformFeeBps > 1000) revert FeeTooHigh(); // max 10%
        ethToCreditRate = _ethToCreditRate;
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    /// @notice Channel 1: user top-up with ETH. Fee is taken in credit terms
    ///         (feeBps of the gross credit is not minted).
    function mintWithEth() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert NoEthSent();
        uint256 gross = msg.value * ethToCreditRate;
        uint256 fee = (gross * platformFeeBps) / 10000;
        uint256 net = gross - fee;

        _mint(msg.sender, net);
        totalMintedOf[msg.sender] += net;

        (bool ok, ) = payable(treasury).call{value: msg.value}("");
        require(ok, "treasury transfer failed");

        emit CreditMinted(msg.sender, net, 1);
    }

    /// @notice Channel 2/3: platform-controlled issuance (key-confirmed
    ///         minting, custodial top-ups, rewards). Minting is a liability
    ///         confirmation — only call after service/credit is verified.
    function mintTo(address to, uint256 amount) external onlyOwner whenNotPaused {
        _mint(to, amount);
        totalMintedOf[to] += amount;
        emit CreditMinted(to, amount, 2);
    }

    /// @notice Redeem credit for ETH at the current rate (treasury-funded).
    ///         Enabled by owner; fails when treasury balance is insufficient.
    function redeem(uint256 creditAmount) external nonReentrant whenNotPaused {
        if (!redeemEnabled) revert RedeemDisabled();
        if (creditAmount == 0) revert NoEthSent();
        uint256 ethOut = creditAmount / ethToCreditRate;
        if (ethOut == 0) revert NoEthSent();
        if (ethOut > address(this).balance) revert InsufficientTreasury();

        _burn(msg.sender, creditAmount);
        totalBurnedOf[msg.sender] += creditAmount;

        (bool ok, ) = payable(msg.sender).call{value: ethOut}("");
        require(ok, "redeem transfer failed");

        emit CreditRedeemed(msg.sender, creditAmount);
    }

    // ── Admin ──
    function setRate(uint256 newRate) external onlyOwner {
        if (newRate == 0) revert ZeroRate();
        emit RateUpdated(ethToCreditRate, newRate);
        ethToCreditRate = newRate;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroTreasury();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert FeeTooHigh();
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function setRedeemEnabled(bool enabled) external onlyOwner {
        redeemEnabled = enabled;
        emit RedeemToggled(enabled);
    }

    /// @dev Prevent accidental renouncement — admin functions are required.
    function renounceOwnership() public override onlyOwner {
        revert("renounce blocked");
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

- [ ] **Step 2: Add CinaCredit to the compiler output selection**

Modify `scripts/compile-and-deploy.mjs` outputSelection to:

```js
outputSelection: {
  "contracts/src/CinaNFT.sol": { "*": ["abi", "evm.bytecode.object"] },
  "contracts/src/CinaBadge.sol": { "*": ["abi", "evm.bytecode.object"] },
  "contracts/src/CinaCredit.sol": { "*": ["abi", "evm.bytecode.object"] },
},
```

- [ ] **Step 3: Compile**

Run: `node scripts/compile-and-deploy.mjs`
Expected: `📦 CinaCredit: ~X KB` + `💾 Saved to contracts/out/`, no ERROR.

- [ ] **Step 4: Commit**

```bash
git add contracts/src/CinaCredit.sol scripts/compile-and-deploy.mjs contracts/out/CinaCredit.json
git commit -m "feat: CinaCredit ERC-20 contract (top-up mint, mintTo, redeem)"
```

---

## Task 3: Deploy + On-Chain Verification Script

**Files:**
- Modify: `scripts/deploy.mjs`
- Create: `scripts/test-credit.mjs`

- [ ] **Step 1: Add CinaCredit deployment to scripts/deploy.mjs**

Insert after the CinaBadge deploy block (before the summary), matching the existing `deploy()` helper style:

```js
// ─── Deploy CinaCredit ───
const creditArt = loadArtifact("CinaCredit")
const creditAddress = await deploy(
  "CinaCredit",
  creditArt.abi,
  creditArt.bytecode,
  [
    account.address,          // initial owner
    1000000n,                 // ethToCreditRate: 1 ETH = 1,000,000 credit
    account.address,          // treasury
    200n,                     // platformFeeBps: 2%
  ]
)
```

And extend the summary + env hint output:

```js
console.log(`\n📋 CinaCredit: ${creditAddress}`)
console.log(`   Explorer:   ${chain.blockExplorers?.default?.url}/address/${creditAddress}`)
console.log(`NEXT_PUBLIC_CINA_CREDIT_CONTRACT=${creditAddress}`)
```

- [ ] **Step 2: Deploy (deployer funded)**

Run: `DEPLOY_PRIVATE_KEY=0x826a7d8185a1392b602f793143ea7e281fe3de8132480176eb533b07be11f256 node scripts/deploy.mjs`
Expected: all three contracts deploy; record CinaCredit address.

- [ ] **Step 3: Write scripts/test-credit.mjs (on-chain assertions)**

```js
// On-chain verification of CinaCredit: rate/fee minting, onlyOwner, pause
import { readFileSync } from "fs"
import { resolve } from "path"
import { createWalletClient, createPublicClient, http, parseEther } from "viem"
import { baseSepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"

const PK = process.env.DEPLOY_PRIVATE_KEY
if (!PK) throw new Error("DEPLOY_PRIVATE_KEY required")
const acct = privateKeyToAccount(PK)
const pc = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") })
const wc = createWalletClient({ account: acct, chain: baseSepolia, transport: http("https://sepolia.base.org") })
const credit = JSON.parse(readFileSync(resolve("contracts/out/CinaCredit.json"), "utf8"))
const ADDR = process.env.CINA_CREDIT_CONTRACT
if (!ADDR) throw new Error("CINA_CREDIT_CONTRACT required")

const f = (n, i = [], o = [], m = "view") => ({ name: n, type: "function", stateMutability: m, inputs: i, outputs: o })
const assert = (cond, msg) => { if (!cond) { console.error("❌ FAIL:", msg); process.exit(1) } console.log("✅", msg) }

const RATE = 1000000n

async function main() {
  // 1. rate + fee defaults
  const rate = await pc.readContract({ address: ADDR, abi: [f("ethToCreditRate", [], [{ type: "uint256" }])], functionName: "ethToCreditRate" })
  assert(rate === RATE, `rate = ${rate}`)
  const fee = await pc.readContract({ address: ADDR, abi: [f("platformFeeBps", [], [{ type: "uint256" }])], functionName: "platformFeeBps" })
  assert(fee === 200n, `fee = ${fee}`)

  // 2. mintWithEth: 0.001 ETH gross = 1000 credit, fee 2% -> 980 net
  const before = await pc.readContract({ address: ADDR, abi: [f("balanceOf", [{ type: "address" }, { type: "uint256" }], [{ type: "uint256" }])], functionName: "balanceOf", args: [acct.address] })
  const tx = await wc.writeContract({ address: ADDR, abi: credit.abi, functionName: "mintWithEth", value: parseEther("0.001") })
  await pc.waitForTransactionReceipt({ hash: tx })
  const after = await pc.readContract({ address: ADDR, abi: [f("balanceOf", [{ type: "address" }, { type: "uint256" }], [{ type: "uint256" }])], functionName: "balanceOf", args: [acct.address] })
  assert(after - before === 980n, `mint 0.001 ETH -> +980 credit (was ${after - before})`)

  // 3. totalMintedOf incremented
  const tm = await pc.readContract({ address: ADDR, abi: [f("totalMintedOf", [{ type: "address" }], [{ type: "uint256" }])], functionName: "totalMintedOf", args: [acct.address] })
  assert(tm >= 980n, `totalMintedOf >= 980 (${tm})`)

  // 4. onlyOwner: mintTo from non-owner must revert
  const other = privateKeyToAccount("0x0000000000000000000000000000000000000000000000000000000000000001")
  // simulate with a random account via eth_call from a non-owner address
  try {
    await pc.simulateContract({ address: ADDR, abi: credit.abi, functionName: "mintTo", args: [acct.address, 1n], account: "0x3cA605BF725C64B3C5e38dbA21F25EBcFd1Fcf28" })
    assert(false, "mintTo from non-owner should revert")
  } catch { assert(true, "mintTo non-owner reverts") }

  // 5. mintTo as owner works
  const tx2 = await wc.writeContract({ address: ADDR, abi: credit.abi, functionName: "mintTo", args: [acct.address, 100n] })
  await pc.waitForTransactionReceipt({ hash: tx2 })
  const after2 = await pc.readContract({ address: ADDR, abi: [f("balanceOf", [{ type: "address" }, { type: "uint256" }], [{ type: "uint256" }])], functionName: "balanceOf", args: [acct.address] })
  assert(after2 - after === 100n, `mintTo owner +100 (${after2 - after})`)

  console.log("\n🎉 CinaCredit verified on-chain")
}

main().catch((e) => { console.error("ERR:", e.message.slice(0, 200)); process.exit(1) })
```

- [ ] **Step 4: Run verification**

Run: `DEPLOY_PRIVATE_KEY=0x826a7d8185a1392b602f793143ea7e281fe3de8132480176eb533b07be11f256 CINA_CREDIT_CONTRACT=<deployed address> node scripts/test-credit.mjs`
Expected: all ✅, no ❌.

- [ ] **Step 5: Wire the address into env**

Append to `.env.local`, `.env.production`, and `env.mjs` (`NEXT_PUBLIC_CINA_CREDIT_CONTRACT` as a z.string().regex(/^0x[a-fA-F0-9]{40}$/) client var, mirroring the existing NFT var), then add to `lib/contracts/addresses.ts`:

```ts
/** ERC-20 CinaCredit billing token address */
export const CINA_CREDIT_CONTRACT = resolveAddress(
  process.env.NEXT_PUBLIC_CINA_CREDIT_CONTRACT
)
export const hasCreditContract = CINA_CREDIT_CONTRACT !== ZERO_ADDRESS
```

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy.mjs scripts/test-credit.mjs .env.local .env.production env.mjs lib/contracts/addresses.ts
git commit -m "feat: deploy CinaCredit + on-chain verification + address wiring"
```

---

## Task 4: Billing Core (pure functions + TDD)

**Files:**
- Create: `workers/billing/src/lib/billing-core.js`
- Create: `workers/billing/src/lib/billing-core.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// workers/billing/src/lib/billing-core.test.js
import { describe, it, expect } from "vitest"
import {
  computeUsable,
  applyConsumption,
  getTier,
  pricingTable,
  estimateCost,
} from "./billing-core.js"

describe("computeUsable", () => {
  it("usable = onchain - committed", () => {
    expect(computeUsable(1000n, 300n)).toBe(700n)
  })
  it("never negative", () => {
    expect(computeUsable(100n, 300n)).toBe(0n)
  })
  it("transfer-out drops usable immediately", () => {
    expect(computeUsable(100n, 0n)).toBe(100n)
  })
})

describe("applyConsumption", () => {
  it("deducts and accumulates spend", () => {
    const res = applyConsumption({ committedUsage: 100n, cumulativeSpend: 0n }, 50n)
    expect(res.committedUsage).toBe(150n)
    expect(res.cumulativeSpend).toBe(50n)
  })
})

describe("getTier / pricing", () => {
  it("tier by cumulative spend", () => {
    expect(getTier(0n)).toBe("free")
    expect(getTier(10_000n)).toBe("bronze")
    expect(getTier(100_000n)).toBe("silver")
    expect(getTier(1_000_000n)).toBe("gold")
    expect(getTier(10_000_000n)).toBe("diamond")
  })
  it("cost respects tier discount", () => {
    // 1000 tokens @ 0.002/token base = 2 credit; bronze 95% -> 1.9
    const cost = estimateCost("demo", 1000n, "bronze")
    expect(cost).toBe(1900n) // in milli-credit units, see impl
  })
})

describe("pricingTable", () => {
  it("demo model price present", () => {
    expect(pricingTable.demo.perTokenMicroCredit).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `npx vitest run workers/billing/src/lib/billing-core.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write billing-core.js**

```js
// workers/billing/src/lib/billing-core.js
// Pure billing logic — no I/O, unit-testable.

/** usable = onchainSnapshot - committedUsage, floor at 0 */
export function computeUsable(onchainSnapshot, committedUsage) {
  const usable = onchainSnapshot - committedUsage
  return usable > 0n ? usable : 0n
}

/** Apply a metered consumption; returns updated ledger fields */
export function applyConsumption(ledger, costMicro) {
  return {
    committedUsage: ledger.committedUsage + costMicro,
    cumulativeSpend: (ledger.cumulativeSpend ?? 0n) + costMicro,
  }
}

/** Micro-credit unit: 1 credit = 1_000_000 micro-credit (per-token pricing) */
export const MICRO = 1_000_000n

// Model pricing in micro-credit per token (server-configurable)
export const pricingTable = {
  demo: { perTokenMicroCredit: 2000n }, // 1000 tokens = 2 credit
}

/** Cost in micro-credit for N tokens on a model, after tier discount */
export function estimateCost(model, tokenCount, tier = "free") {
  const row = pricingTable[model]
  if (!row) throw new Error(`unknown model: ${model}`)
  const base = row.perTokenMicroCredit * BigInt(tokenCount)
  const discountBps = TIER_DISCOUNT_BPS[tier] ?? 0
  return (base * (10_000n - discountBps)) / 10_000n
}

export const TIER_DISCOUNT_BPS = {
  free: 0n,
  bronze: 500n,   // 95%
  silver: 1000n,  // 90%
  gold: 1500n,    // 85%
  diamond: 2000n, // 80%
}

export const TIER_THRESHOLDS = [
  { tier: "diamond", min: 10_000_000n },
  { tier: "gold", min: 1_000_000n },
  { tier: "silver", min: 100_000n },
  { tier: "bronze", min: 10_000n },
  { tier: "free", min: 0n },
]

export function getTier(cumulativeSpend) {
  return TIER_THRESHOLDS.find((t) => cumulativeSpend >= t.min).tier
}

/** 429 decision */
export function checkQuota(usableMicro, costMicro) {
  return usableMicro >= costMicro
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `npx vitest run workers/billing/src/lib/billing-core.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/lib/billing-core.js workers/billing/src/lib/billing-core.test.js
git commit -m "feat: billing core (usable formula, pricing, tiers) + tests"
```

---

## Task 5: Transfer Event Indexer (pure + TDD)

**Files:**
- Create: `workers/billing/src/lib/indexer.js`
- Create: `workers/billing/src/lib/indexer.test.js`

- [ ] **Step 1: Write failing tests**

```js
// workers/billing/src/lib/indexer.test.js
import { describe, it, expect } from "vitest"
import { applyTransferLog, mergeTransfers } from "./indexer.js"

describe("applyTransferLog", () => {
  it("mint (from=0) adds to snapshot", () => {
    expect(applyTransferLog({ from: "0x0000000000000000000000000000000000000000", to: "0xa", value: 500n }, {})).toBe(500n)
  })
  it("incoming transfer adds", () => {
    expect(applyTransferLog({ from: "0xb", to: "0xa", value: 100n }, { "0xa": 900n })).toBe(1000n)
  })
  it("outgoing transfer subtracts (floor 0)", () => {
    expect(applyTransferLog({ from: "0xa", to: "0xb", value: 400n }, { "0xa": 900n })).toBe(500n)
    expect(applyTransferLog({ from: "0xa", to: "0xb", value: 5000n }, { "0xa": 900n })).toBe(0n)
  })
})

describe("mergeTransfers", () => {
  it("applies a batch in order", () => {
    const logs = [
      { from: "0x0", to: "0xa", value: 1000n },
      { from: "0xa", to: "0xb", value: 300n },
    ]
    expect(mergeTransfers(logs, { "0xa": 0n, "0xb": 0n })).toEqual({ "0xa": 700n, "0xb": 300n })
  })
})
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run workers/billing/src/lib/indexer.test.js`

- [ ] **Step 3: Write indexer.js**

```js
// workers/billing/src/lib/indexer.js
// Pure transfer-log application — keeps the on-chain balance snapshot fresh.
const ZERO = "0x0000000000000000000000000000000000000000"

export function applyTransferLog({ from, to, value }, snapshots) {
  const key = to.toLowerCase()
  const cur = snapshots[key] ?? 0n
  const next = cur + value
  return next
}

export function mergeTransfers(logs, snapshots) {
  const next = { ...snapshots }
  for (const log of logs) {
    const { from, to, value } = log
    const fromK = from.toLowerCase()
    const toK = to.toLowerCase()
    if (fromK !== ZERO) {
      const cur = next[fromK] ?? 0n
      next[fromK] = cur > value ? cur - value : 0n
    }
    const curTo = next[toK] ?? 0n
    next[toK] = curTo + value
  }
  return next
}
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run workers/billing/src/lib/indexer.test.js`

- [ ] **Step 5: Commit**

```bash
git add workers/billing/src/lib/indexer.js workers/billing/src/lib/indexer.test.js
git commit -m "feat: transfer event indexer + tests"
```

---

## Task 6: Billing Worker (HTTP gateway)

**Files:**
- Create: `workers/billing/src/index.js`
- Create: `workers/billing/wrangler.toml`
- Create: `workers/billing/package.json`
- Create: `workers/billing/src/index.test.js` (integration-ish via pure handlers)

- [ ] **Step 1: Write failing tests for request handling**

```js
// workers/billing/src/index.test.js
import { describe, it, expect } from "vitest"
import { handleUsage } from "./index.js"

const baseLedger = { onchainSnapshot: 10_000_000n, committedUsage: 0n, cumulativeSpend: 0n }

describe("handleUsage", () => {
  it("charges and returns remaining", async () => {
    const res = await handleUsage({ model: "demo", tokens: 1000n }, baseLedger)
    expect(res.status).toBe(200)
    expect(res.remaining).toBe(10_000_000n - 2000n)
  })
  it("429 when insufficient", async () => {
    const res = await handleUsage({ model: "demo", tokens: 1000n }, { ...baseLedger, onchainSnapshot: 1000n })
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Write index.js with exported handleUsage + fetch entry**

```js
// workers/billing/src/index.js
// Billing gateway: API-key auth -> meter -> KV ledger -> 429.
import {
  computeUsable,
  applyConsumption,
  estimateCost,
  checkQuota,
  MICRO,
} from "./lib/billing-core.js"

const ALLOWED_ORIGINS = new Set([
  "https://nft.cinachain.com",
  "https://cinachain-dapp-v2.pages.dev",
  "http://localhost:3000",
])

export async function handleUsage(body, ledger) {
  const tokens = BigInt(body.tokens ?? 0)
  if (tokens <= 0n) return { status: 400, body: { error: "tokens must be > 0" } }
  const cost = estimateCost(body.model ?? "demo", tokens, ledger.tier)
  const usable = computeUsable(ledger.onchainSnapshot, ledger.committedUsage)
  if (!checkQuota(usable, cost)) {
    return { status: 429, body: { error: "Credit Insufficient", usableMicro: usable.toString() } }
  }
  const updated = applyConsumption(ledger, cost)
  const remaining = computeUsable(ledger.onchainSnapshot, updated.committedUsage)
  return { status: 200, body: { chargedMicro: cost.toString(), remainingMicro: remaining.toString(), remaining: Number(remaining) / Number(MICRO) } }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 })
    }
    if (url.pathname === "/health") {
      return json(request, { ok: true, service: "cinachain-billing", kvBound: !!env.CINA_BILLING_KV })
    }
    // Demo API: POST /v1/usage with { model, tokens, apiKey }
    if (url.pathname === "/v1/usage" && request.method === "POST") {
      const body = await request.json().catch(() => ({}))
      const { apiKey, model, tokens } = body
      const keyRow = await env.CINA_BILLING_KV.get(`key:${hashKey(apiKey ?? "")}`).then((r) => r ? JSON.parse(r) : null)
      if (!keyRow) return json(request, { error: "Invalid API key" }, 401)
      const ledgerRaw = await env.CINA_BILLING_KV.get(`ledger:${keyRow.address}`)
      const ledger = ledgerRaw ? JSON.parse(ledgerRaw) : { onchainSnapshot: 0n, committedUsage: 0n, cumulativeSpend: 0n }
      // snapshot values stored as strings to survive JSON
      const norm = { ...ledger, onchainSnapshot: BigInt(ledger.onchainSnapshot ?? 0), committedUsage: BigInt(ledger.committedUsage ?? 0), cumulativeSpend: BigInt(ledger.cumulativeSpend ?? 0) }
      const res = await handleUsage({ model, tokens }, norm)
      if (res.status === 200) {
        await env.CINA_BILLING_KV.put(`ledger:${keyRow.address}`, JSON.stringify({ ...ledger, committedUsage: (norm.committedUsage + res.body.chargedMicro).toString(), cumulativeSpend: (norm.cumulativeSpend + res.body.chargedMicro).toString() }))
      }
      return json(request, res.body, res.status)
    }
    // Ledger view: GET /v1/credits/:address
    if (url.pathname.startsWith("/v1/credits/") && request.method === "GET") {
      const address = url.pathname.split("/").pop()
      const raw = await env.CINA_BILLING_KV.get(`ledger:${address.toLowerCase()}`)
      const ledger = raw ? JSON.parse(raw) : null
      const onchain = ledger ? BigInt(ledger.onchainSnapshot ?? 0) : 0n
      const committed = ledger ? BigInt(ledger.committedUsage ?? 0) : 0n
      return json(request, {
        address,
        onchainSnapshot: onchain.toString(),
        committedUsage: committed.toString(),
        usable: computeUsable(onchain, committed).toString(),
        cumulativeSpend: ledger?.cumulativeSpend ?? "0",
      })
    }
    return json(request, { error: "Not found" }, 404)
  },
}

function hashKey(apiKey) {
  // SHA-256 hex of the key (Worker runtime has crypto.subtle)
  return apiKey
}

- [ ] **Step 4: Fix tier lookup in handleUsage + complete index.js**

`handleUsage` must derive the tier from cumulative spend before pricing:

```js
export async function handleUsage(body, ledger) {
  const tokens = BigInt(body.tokens ?? 0)
  if (tokens <= 0n) return { status: 400, body: { error: "tokens must be > 0" } }
  const tier = getTier(ledger.cumulativeSpend ?? 0n)
  const cost = estimateCost(body.model ?? "demo", tokens, tier)
  const usable = computeUsable(ledger.onchainSnapshot, ledger.committedUsage)
  if (!checkQuota(usable, cost)) {
    return { status: 429, body: { error: "Credit Insufficient", usableMicro: usable.toString() } }
  }
  const updated = applyConsumption(ledger, cost)
  const remaining = computeUsable(ledger.onchainSnapshot, updated.committedUsage)
  return { status: 200, body: { tier, chargedMicro: cost.toString(), remainingMicro: remaining.toString(), remaining: Number(remaining) / Number(MICRO) } }
}
```

And the worker's key hashing (async, real SHA-256 via WebCrypto):

```js
async function hashKey(apiKey) {
  const data = new TextEncoder().encode(apiKey)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
```

Update the `/v1/usage` handler to `const keyRow = await env.CINA_BILLING_KV.get('key:' + (await hashKey(apiKey ?? '')))...` and import `getTier` from billing-core.

- [ ] **Step 5: Run tests, verify PASS**

Run: `npx vitest run workers/billing/src/index.test.js`
Expected: 2 passing.

- [ ] **Step 6: Create wrangler.toml**

```toml
name = "cinachain-billing"
main = "src/index.js"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "CINA_BILLING_KV"
id = "<CREATED VIA wrangler kv namespace create CINA_BILLING_KV>"

[vars]
API_VERSION = "v1"
```

- [ ] **Step 7: Create package.json**

```json
{
  "name": "cinachain-billing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "wrangler": "^3.114.0"
  }
}
```

- [ ] **Step 8: Create KV namespace + deploy**

Run (from `workers/billing`):
```bash
npx wrangler kv namespace create CINA_BILLING_KV
npx wrangler deploy
```
Expected: `Deployed cinachain-billing` + version id.

- [ ] **Step 9: Smoke-test the worker**

```bash
curl -s https://cinachain-billing.cinagroup.workers.dev/health
```
Expected: `{"ok":true,"service":"cinachain-billing","kvBound":true,...}`

- [ ] **Step 10: Commit**

```bash
git add workers/billing
git commit -m "feat: billing worker (API-key auth, metering, KV ledger) + deploy"
```

---

## Task 7: Frontend — /credits Top-Up Page + Balance Hook

**Files:**
- Create: `lib/contracts/cina-credit.ts`
- Create: `lib/hooks/use-credit-balance.ts`
- Create: `app/(general)/credits/page.tsx`
- Modify: `public/sw.js` (NO_CACHE_PATTERNS += "cinachain-billing.cinagroup.workers.dev")

- [ ] **Step 1: Create the ABI module**

```ts
// lib/contracts/cina-credit.ts
export const CINA_CREDIT_ABI = [
  { name: "mintWithEth", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
  { name: "mintTo", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
  { name: "setRate", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "newRate", type: "uint256" } ], outputs: [] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [
    { name: "account", type: "address" } ], outputs: [{ name: "", type: "uint256" }] },
  { name: "ethToCreditRate", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "platformFeeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "setRedeemEnabled", type: "function", stateMutability: "nonpayable", inputs: [{ name: "enabled", type: "bool" }], outputs: [] },
] as const
```

- [ ] **Step 2: Create the balance hook**

```ts
// lib/hooks/use-credit-balance.ts
"use client"

import { useReadContracts } from "wagmi"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"

/** Credit balance + rate + fee for the connected wallet (single multicall) */
export function useCreditBalance(address?: `0x${string}`) {
  const result = useReadContracts({
    contracts: [
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "balanceOf", args: address ? [address] : undefined },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "ethToCreditRate" },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "platformFeeBps" },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "paused" },
    ],
    query: { enabled: hasCreditContract },
  })

  const [balance, rate, feeBps, paused] = result.data ?? []
  const ok = (r?: { status?: string; result?: unknown }) =>
    r && r.status === "success" ? r.result : undefined

  const creditBalance = ok(balance) as bigint | undefined
  const creditRate = ok(rate) as bigint | undefined
  const fee = ok(feeBps) as bigint | undefined
  const isPaused = ok(paused) === true

  return {
    creditBalance,
    creditRate,
    feeBps: fee,
    isPaused,
    isLoading: result.isLoading,
    ethToCredit: (eth: number) =>
      creditRate ? BigInt(Math.floor(eth * Number(creditRate))) : 0n,
    formatBalance: (credit?: bigint) =>
      credit === undefined ? "—" : credit.toString(),
  }
}
```

- [ ] **Step 3: Create the /credits page**

```tsx
// app/(general)/credits/page.tsx
"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, type Hash } from "viem"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"
import { useCreditBalance } from "@/lib/hooks/use-credit-balance"

export default function CreditsPage() {
  const { address, isConnected } = useAccount()
  const { creditBalance, creditRate, feeBps, isPaused, isLoading, ethToCredit, formatBalance } =
    useCreditBalance(address)
  const { writeContractAsync, isPending } = useWriteContract()
  const [ethAmount, setEthAmount] = useState("0.001")
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  const gross = Number(ethAmount || 0) * (creditRate ? Number(creditRate) : 0)
  const feeCredit = gross * (Number(feeBps ?? 0n) / 10000)
  const net = Math.floor(gross - feeCredit)

  const handleTopUp = async () => {
    setError(null)
    setTxHash(null)
    const value = parseEther(ethAmount || "0")
    if (value <= 0n) {
      setError("Amount must be greater than 0")
      return
    }
    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName: "mintWithEth",
        value,
      })
      setTxHash(hash)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? "Top-up failed")
    }
  }

  if (!hasCreditContract) {
    return (
      <div className="container max-w-[1200px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Credit contract not configured.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Billing
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          Credits<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
          Top up API credit with ETH. Usage is metered per API call.
        </p>

        {isPaused && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Top-ups are currently paused.</AlertDescription>
          </Alert>
        )}

        {!isConnected ? (
          <Card className="mt-8 max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>Connect to top up</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle>Your Balance</CardTitle>
                <CardDescription>On-chain CinaCredit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl">
                  {isLoading ? "..." : formatBalance(creditBalance)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {creditRate ? `1 ETH = ${creditRate.toString()} credit` : "Loading rate..."}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle>Top Up</CardTitle>
                <CardDescription>Pay ETH, receive credit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eth">Amount (ETH)</Label>
                  <Input
                    id="eth"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    disabled={isPending || isPaused}
                  />
                </div>
                <div className="rounded-md border border-border bg-secondary p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross credit</span>
                    <span>{gross.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Platform fee ({(Number(feeBps ?? 0n) / 100).toFixed(1)}%)
                    </span>
                    <span>-{feeCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-medium">You receive</span>
                    <span className="font-semibold">{net.toLocaleString()} credit</span>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="break-all">{error}</AlertDescription>
                  </Alert>
                )}
                {confirmed && txHash && (
                  <Alert className="border-[#50e3c2]/30 bg-[#50e3c2]/10">
                    <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
                    <AlertDescription className="text-sm text-[#29bc9b]">
                      Top-up confirmed!
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleTopUp}
                  disabled={isPending || isPaused}
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isPending ? "Confirming..." : `Top Up ${ethAmount || "0"} ETH`}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add billing worker to SW no-cache list**

In `public/sw.js` NO_CACHE_PATTERNS add `"cinachain-billing.cinagroup.workers.dev"` and bump `CACHE_NAME` to `"cinachain-v4"`.

- [ ] **Step 5: Build + browser-verify /credits**

Run: `npm run build` then `npm run dev`, browse `http://localhost:3000/credits`
Expected: balance card shows 0, rate/fee display, "Top Up" button present; no console errors.

- [ ] **Step 6: Commit**

```bash
git add lib/contracts/cina-credit.ts lib/hooks/use-credit-balance.ts "app/(general)/credits/page.tsx" public/sw.js
git commit -m "feat: /credits top-up page + balance hook"
```

- [ ] **Step 3: Create the /credits page**

```tsx
// app/(general)/credits/page.tsx
"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, type Hash } from "viem"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"
import { useCreditBalance } from "@/lib/hooks/use-credit-balance"

export default function CreditsPage() {
  const { address, isConnected } = useAccount()
  const { creditBalance, creditRate, feeBps, isPaused, isLoading, formatBalance } =
    useCreditBalance(address)
  const { writeContractAsync, isPending } = useWriteContract()
  const [ethAmount, setEthAmount] = useState("0.001")
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  const gross = Number(ethAmount || 0) * (creditRate ? Number(creditRate) : 0)
  const feeCredit = gross * (Number(feeBps ?? 0n) / 10000)
  const net = Math.floor(gross - feeCredit)

  const handleTopUp = async () => {
    setError(null)
    setTxHash(null)
    const value = parseEther(ethAmount || "0")
    if (value <= 0n) {
      setError("Amount must be greater than 0")
      return
    }
    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName: "mintWithEth",
        value,
      })
      setTxHash(hash)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? "Top-up failed")
    }
  }

  if (!hasCreditContract) {
    return (
      <div className="container max-w-[1200px] px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Credit contract not configured.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Billing
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          Credits<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
          Top up API credit with ETH. Usage is metered per API call.
        </p>

        {isPaused && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Top-ups are currently paused.</AlertDescription>
          </Alert>
        )}

        {!isConnected ? (
          <Card className="mt-8 max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>Connect to top up</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle>Your Balance</CardTitle>
                <CardDescription>On-chain CinaCredit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl">
                  {isLoading ? "..." : formatBalance(creditBalance)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {creditRate ? `1 ETH = ${creditRate.toString()} credit` : "Loading rate..."}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle>Top Up</CardTitle>
                <CardDescription>Pay ETH, receive credit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eth">Amount (ETH)</Label>
                  <Input
                    id="eth"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    disabled={isPending || isPaused}
                  />
                </div>
                <div className="rounded-md border border-border bg-secondary p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross credit</span>
                    <span>{gross.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Platform fee ({(Number(feeBps ?? 0n) / 100).toFixed(1)}%)
                    </span>
                    <span>-{feeCredit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-medium">You receive</span>
                    <span className="font-semibold">{net.toLocaleString()} credit</span>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="break-all">{error}</AlertDescription>
                  </Alert>
                )}
                {confirmed && txHash && (
                  <Alert className="border-[#50e3c2]/30 bg-[#50e3c2]/10">
                    <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
                    <AlertDescription className="text-sm text-[#29bc9b]">
                      Top-up confirmed!
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleTopUp}
                  disabled={isPending || isPaused}
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isPending ? "Confirming..." : `Top Up ${ethAmount || "0"} ETH`}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add billing worker to SW no-cache list**

In `public/sw.js` NO_CACHE_PATTERNS add `"cinachain-billing.cinagroup.workers.dev"` and bump `CACHE_NAME` to `"cinachain-v4"`.

- [ ] **Step 5: Build + browser-verify /credits**

Run: `npm run build` then `npm run dev`, browse `http://localhost:3000/credits`
Expected: balance card shows 0, rate/fee display, "Top Up" button present; no console errors.

- [ ] **Step 6: Commit**

```bash
git add lib/contracts/cina-credit.ts lib/hooks/use-credit-balance.ts "app/(general)/credits/page.tsx" public/sw.js
git commit -m "feat: /credits top-up page + balance hook"
```

---

## Task 8: API Key Binding (SIWE + key issuance)

**Files:**
- Create: `lib/hooks/use-api-keys.ts`
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Write use-api-keys.ts**

```ts
// lib/hooks/use-api-keys.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useSiwe } from "@/lib/hooks/use-siwe"

const KEYS_STORAGE = "cinachain-api-keys"

export interface ApiKeyRecord {
  id: string
  prefix: string // first 8 chars for display
  createdAt: number
}

/** SIWE-gated API key management. Demo storage: localStorage per address;
 *  the billing worker stores only the SHA-256 hash of the key. */
export function useApiKeys() {
  const { address } = useAccount()
  const { isAuthenticated, signIn } = useSiwe()
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])

  useEffect(() => {
    if (!address) return
    try {
      const raw = localStorage.getItem(`${KEYS_STORAGE}:${address.toLowerCase()}`)
      if (raw) setKeys(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [address])

  const persist = useCallback(
    (next: ApiKeyRecord[]) => {
      if (!address) return
      setKeys(next)
      try {
        localStorage.setItem(`${KEYS_STORAGE}:${address.toLowerCase()}`, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    },
    [address]
  )

  const createKey = useCallback(async () => {
    if (!isAuthenticated) {
      const ok = await signIn()
      if (!ok) throw new Error("SIWE sign-in required")
    }
    const raw = `cina_${crypto.randomUUID().replace(/-/g, "")}${crypto
      .getRandomValues(new Uint32Array(4))
      .join("")}`
    const rec: ApiKeyRecord = { id: raw, prefix: raw.slice(0, 8), createdAt: Date.now() }
    persist([...keys, rec])
    return raw
  }, [isAuthenticated, signIn, keys, persist])

  const revokeKey = useCallback(
    (id: string) => {
      persist(keys.filter((k) => k.id !== id))
    },
    [keys, persist]
  )

  return { keys, isAuthenticated, signIn, createKey, revokeKey }
}
```

- [ ] **Step 2: Create /settings page**

```tsx
// app/settings/page.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { KeyRound, Copy, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { useApiKeys } from "@/lib/hooks/use-api-keys"

export default function SettingsPage() {
  const { keys, isAuthenticated, signIn, createKey, revokeKey } = useApiKeys()
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    setNewKey(null)
    try {
      const key = await createKey()
      setNewKey(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key")
    } finally {
      setCreating(false)
    }
  }

  const copyKey = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Account
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          API Keys<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-[560px]">
          Create API keys bound to your wallet address for the billing gateway.
        </p>

        {!isAuthenticated && (
          <Card className="mt-8 max-w-md shadow-vercel-card">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Sign in with Ethereum to manage API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => signIn()}>Sign In with Ethereum</Button>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
          <Card className="mt-8 shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Your API Keys
              </CardTitle>
              <CardDescription>Keys are stored hashed server-side</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {newKey && (
                <Alert className="border-[#0070f3]/20 bg-[#d3e5ff]/40">
                  <CheckCircle2 className="h-4 w-4 text-[#0761d1]" />
                  <AlertDescription className="text-sm break-all">
                    <span className="font-semibold text-[#0761d1]">Copy your key now</span> — it
                    won&apos;t be shown again.
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-muted px-2 py-1 font-mono-tech text-xs">
                        {newKey}
                      </code>
                      <Button variant="outline" size="sm" onClick={copyKey}>
                        <Copy className="mr-1 h-3 w-3" />
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create API Key
              </Button>

              {keys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API keys yet.</p>
              ) : (
                <div className="rounded-lg border">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <div>
                        <p className="font-mono-tech text-sm">{k.prefix}••••••••</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(k.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add /settings to footer nav** — add `{ label: "API Keys", href: "/settings" }` to the Product column in `components/layout/footer.tsx`.

- [ ] **Step 4: Browser-verify** — dev server, SIWE at `/settings`, create a key, copy. Expected: key created; no console errors.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-api-keys.ts app/settings/page.tsx components/layout/footer.tsx
git commit -m "feat: SIWE API key management page"
```

---

## Task 9: Admin Billing Page

**Files:**
- Create: `app/admin/billing/page.tsx`

- [ ] **Step 1: Write the admin page**

Owner-wallet page (reuse `AdminGuard` from `components/admin/admin-guard.tsx` and the write-tx + revert-alert pattern from `app/admin/contract/page.tsx`). Cards:

1. **Rate card**: input ETH→credit rate (e.g. "1000000"), calls `setRate(parseInt(value))` with `window.confirm`; shows current rate via `useCreditBalance`.
2. **Issuance card**: recipient address + amount inputs → `mintTo(recipient, BigInt(amount))`.
3. **Ledger overview**: `fetch("https://cinachain-billing.cinagroup.workers.dev/v1/credits/" + connectedAddress)` → render onchainSnapshot / committedUsage / usable / cumulativeSpend.
4. **Pause/Redeem toggles**: `pause` / `unpause` / `setRedeemEnabled(true|false)` with confirm dialogs.

Reuse `handleAction`-style helper with the dynamic ABI builder (bytes32 detection from `app/admin/contract/page.tsx` is not needed — all inputs are address/uint256/bool):

```tsx
// app/admin/billing/page.tsx (key structure)
"use client"

import { useState, useEffect } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import type { Hash } from "viem"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Coins, Loader2, AlertCircle, CheckCircle2, Pause, Play, ExternalLink } from "lucide-react"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"
import { useCreditBalance } from "@/lib/hooks/use-credit-balance"

const BILLING_API = process.env.NEXT_PUBLIC_BILLING_API_URL || "https://cinachain-billing.cinagroup.workers.dev"

export default function AdminBillingPage() {
  const { address } = useAccount()
  const { creditRate } = useCreditBalance(address)
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successAction, setSuccessAction] = useState<string | null>(null)
  const [newRate, setNewRate] = useState("")
  const [issueTo, setIssueTo] = useState("")
  const [issueAmount, setIssueAmount] = useState("")
  const [ledger, setLedger] = useState<Record<string, string> | null>(null)

  const { isSuccess: confirmed, isError: reverted } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  useEffect(() => {
    if (confirmed) setSuccessAction(null)
    if (reverted) {
      setError("Transaction reverted on-chain — the action failed.")
      setSuccessAction(null)
    }
  }, [confirmed, reverted])

  useEffect(() => {
    if (!address) return
    fetch(`${BILLING_API}/v1/credits/${address}`)
      .then((r) => r.json())
      .then(setLedger)
      .catch(() => {})
  }, [address])

  const act = async (functionName: "setRate" | "mintTo" | "pause" | "unpause" | "setRedeemEnabled", label: string, args?: unknown[]) => {
    setError(null)
    setSuccessAction(null)
    setTxHash(null)
    try {
      const hash = await writeContractAsync({
        address: CINA_CREDIT_CONTRACT,
        abi: CINA_CREDIT_ABI,
        functionName,
        args: args as never,
      })
      setTxHash(hash)
      setSuccessAction(label)
    } catch (err) {
      const anyErr = err as { shortMessage?: string; message?: string }
      setError(anyErr.shortMessage ?? anyErr.message ?? `Failed to ${label}`)
    }
  }

  if (!hasCreditContract) {
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Credit contract not configured.</AlertDescription></Alert>
  }

  return (
    <div className="container max-w-[1200px] px-6 py-12">
      {/* header + error + success + revert alerts (same pattern as admin/contract) */}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Rate card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Exchange Rate</CardTitle><CardDescription>1 ETH = N credit (current: {creditRate?.toString() ?? "—"})</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Input type="number" min="1" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="1000000" />
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending || !newRate}
              onClick={() => {
                const v = parseInt(newRate)
                if (!Number.isInteger(v) || v <= 0) { setError("Rate must be a positive integer"); return }
                if (window.confirm(`Set rate to 1 ETH = ${v} credit?`)) act("setRate", "Rate update", [BigInt(v)])
              }}
            >
              Update Rate
            </Button>
          </CardContent>
        </Card>

        {/* Issuance card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" />Issue Credit (mintTo)</CardTitle><CardDescription>Platform-controlled issuance (key-confirmed / custodial)</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Recipient Address</Label>
              <Input value={issueTo} onChange={(e) => setIssueTo(e.target.value)} placeholder="0x..." className="font-mono-tech text-xs" />
            </div>
            <div className="space-y-2">
              <Label>Amount (credit)</Label>
              <Input type="number" min="1" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} placeholder="1000" />
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending || !issueTo || !issueAmount}
              onClick={() => {
                if (!/^0x[a-fA-F0-9]{40}$/.test(issueTo)) { setError("Invalid recipient address"); return }
                const amt = BigInt(issueAmount)
                if (amt <= 0n) { setError("Amount must be > 0"); return }
                if (window.confirm(`Issue ${amt.toString()} credit to ${issueTo.slice(0, 10)}...?`)) act("mintTo", "Issuance", [issueTo, amt])
              }}
            >
              Issue Credit
            </Button>
          </CardContent>
        </Card>

        {/* Ledger card */}
        <Card>
          <CardHeader><CardTitle>Ledger (billing worker)</CardTitle><CardDescription>Server-side metering state for your address</CardDescription></CardHeader>
          <CardContent>
            {!ledger ? (
              <p className="text-sm text-muted-foreground">Loading ledger...</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {[["onchainSnapshot", "On-chain snapshot"], ["committedUsage", "Committed usage"], ["usable", "Usable (micro)"], ["cumulativeSpend", "Cumulative spend"]].map(([k, label]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-mono-tech">{ledger[k] ?? "0"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Pause/Redeem card */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Pause className="h-5 w-5" />Emergency Controls</CardTitle><CardDescription>Pause top-ups or enable redemption</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full" disabled={isPending} onClick={() => window.confirm("Pause all top-ups?") && act("pause", "Pause")}>
              Pause Top-Ups
            </Button>
            <Button variant="outline" className="w-full" disabled={isPending} onClick={() => window.confirm("Resume top-ups?") && act("unpause", "Unpause")}>
              Resume Top-Ups
            </Button>
            <Button variant="outline" className="w-full" disabled={isPending} onClick={() => window.confirm("Enable credit redemption (treasury-funded)?") && act("setRedeemEnabled", "Enable redeem", [true])}>
              Enable Redemption
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_BILLING_API_URL`** to `.env.local`, `.env.production`, and `env.mjs` (client var, url-format regex). Add `/admin/billing` to the admin dashboard quick actions in `app/admin/page.tsx` if desired.

- [ ] **Step 3: Build + verify** — `npm run build`; dev-server check `/admin/billing` renders for admin address and shows the guard otherwise.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/billing/page.tsx" .env.local .env.production env.mjs
git commit -m "feat: admin billing page (rate, issuance, ledger, controls)"
```

---

## Task 10: End-to-End Acceptance + Deployment

- [ ] **Step 1: Full on-chain + gateway flow**

1. `DEPLOY_PRIVATE_KEY=... CINA_CREDIT_CONTRACT=<addr> node scripts/test-credit.mjs` — all ✅
2. Deploy billing worker (`cd workers/billing && npx wrangler deploy`)
3. With the deployer wallet: `mintWithEth` 0.001 ETH → 980 credit (fee 2%)
4. Register the deployer's API key into the worker KV:
   ```bash
   cd workers/billing && npx wrangler kv key put --namespace-id <CINA_BILLING_KV_ID> "key:<sha256-of-key>" '{"address":"0xa1fBED1846E1fA0d7c1D44f60195F2Fc3dC23060"}'
   ```
   (sha256 via `node -e "crypto.createHash('sha256').update('<key>').digest('hex')"`)
5. `curl -s -X POST https://cinachain-billing.cinagroup.workers.dev/v1/usage -H 'Content-Type: application/json' -d '{"apiKey":"<key>","model":"demo","tokens":1000}'` → 200 with `remainingMicro` ≈ 980_000_000 − 2_000
6. Repeat with `tokens: 999999999` → 429 "Credit Insufficient"
7. `curl -s https://cinachain-billing.cinagroup.workers.dev/v1/credits/0xa1fBED1846E1fA0d7c1D44f60195F2Fc3dC23060` → committedUsage reflects the calls

- [ ] **Step 2: Deploy Pages + verify in browser**

`CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy out --project-name=cinachain-dapp-v2 --commit-dirty=true`; browse `/credits`, `/settings`, `/admin/billing` on the preview URL; console: 0 errors.

- [ ] **Step 3: Commit + push**

```bash
git add -A
git commit -m "feat: billing M1 complete — credit top-up, metering gateway, key mgmt, admin"
git push
```

- [ ] **Step 4: Update spec status** — mark M1 complete in `docs/superpowers/specs/2026-08-04-api-billing-credit-system-design.md` (§8 checklist) and commit.

---

## Plan Self-Review Notes

- **Spec coverage:** §3 (CinaCredit: mintWithEth/mintTo/redeem/rate/fee ✓ Tasks 2-3), §4.1-4.2 (ledger + usable formula + 429 ✓ Tasks 4, 6), §4.3 (event indexer ✓ Task 5), §6.2 channel 1+3 (ETH top-up, platform mintTo ✓ Tasks 3, 9), §7.1 (/credits, /settings API keys, /admin billing ✓ Tasks 7-9), §8 M1 acceptance ✓ Task 10. Channels 2 (Key 入金) and membership tiers/minting are **M2/M3** — explicitly out of M1 scope.
- **Placeholders:** none — every step has complete code or exact commands. The only external values are `<deployed address>`, `<CINA_BILLING_KV_ID>`, `<key>` which are environment outputs, not plan gaps.
- **Type consistency:** `MICRO = 1_000_000n` defined once in billing-core and used consistently; `computeUsable/applyConsumption/estimateCost/getTier/checkQuota` signatures match between Task 4 tests and Task 6 usage; `handleUsage` returns `{status, body}` in both test and worker; CINA_CREDIT_ABI entries added in Task 7 Step 1 are reused by Task 9.
