import { describe, expect, it } from "vitest"

import { routePaymaster } from "../paymaster-route"

const PAYMASTER_URL = "https://paymaster-proxy.example.com"
const BASE_SEPOLIA = 84532

describe("routePaymaster", () => {
  it("routes a Reown smart account via the smart-account path (no capabilities needed)", () => {
    expect(routePaymaster({ accountType: "sa" })).toEqual({
      kind: "smart-account",
    })
    // ... even before capabilities resolve or without a proxy URL configured
    expect(
      routePaymaster({
        accountType: "sa",
        chainId: BASE_SEPOLIA,
        available: {
          [BASE_SEPOLIA]: { paymasterService: { supported: false } },
        },
      })
    ).toEqual({ kind: "smart-account" })
  })

  it("routes a Coinbase Smart Wallet with EIP-5792 paymaster capabilities", () => {
    expect(
      routePaymaster({
        accountType: "coinbase-smart-wallet",
        chainId: BASE_SEPOLIA,
        available: {
          [BASE_SEPOLIA]: { paymasterService: { supported: true } },
        },
        paymasterProxyUrl: PAYMASTER_URL,
      })
    ).toEqual({
      kind: "coinbase",
      capabilities: { paymasterService: { url: PAYMASTER_URL } },
    })
  })

  it("routes an EOA when no paymaster capabilities are advertised", () => {
    expect(
      routePaymaster({
        accountType: "eoa",
        chainId: BASE_SEPOLIA,
        available: {
          [BASE_SEPOLIA]: { paymasterService: { supported: false } },
        },
        paymasterProxyUrl: PAYMASTER_URL,
      })
    ).toEqual({ kind: "eoa" })
  })

  it("routes an EOA when the active chain has no capabilities entry (unknown chainId)", () => {
    expect(
      routePaymaster({
        accountType: "eoa",
        chainId: 1,
        available: {
          [BASE_SEPOLIA]: { paymasterService: { supported: true } },
        },
        paymasterProxyUrl: PAYMASTER_URL,
      })
    ).toEqual({ kind: "eoa" })
  })

  it("routes an EOA when capabilities are still loading (available undefined)", () => {
    expect(
      routePaymaster({
        accountType: "eoa",
        chainId: BASE_SEPOLIA,
        paymasterProxyUrl: PAYMASTER_URL,
      })
    ).toEqual({ kind: "eoa" })
  })

  it("routes an EOA when no paymaster proxy URL is configured", () => {
    expect(
      routePaymaster({
        accountType: "coinbase-smart-wallet",
        chainId: BASE_SEPOLIA,
        available: {
          [BASE_SEPOLIA]: { paymasterService: { supported: true } },
        },
      })
    ).toEqual({ kind: "eoa" })
  })

  it("routes an EOA while disconnected (accountType null)", () => {
    expect(routePaymaster({ accountType: null })).toEqual({ kind: "eoa" })
  })
})
