"use client"

import { useMemo } from "react"
import { useAccount, useCapabilities } from "wagmi"

import { routePaymaster } from "@/lib/paymaster-route"

import { useAccountType } from "./use-account-type"

/**
 * Returns paymaster routing for the connected account:
 * - Reown smart account ("sa"): AppKit's smart-account flow handles the
 *   UserOp and paymaster sponsorship internally (inside the Reown cloud
 *   iframe); no manual capabilities are needed. `viaSmartAccount` lets
 *   callers skip the manual sendCalls path and use plain writeContract —
 *   the iframe converts eth_sendTransaction into a UserOp automatically.
 * - Coinbase Smart Wallet ("coinbase-smart-wallet"): EIP-5792 paymaster
 *   capabilities (paymaster proxy URL) to attach to sendCalls for gasless
 *   transactions (see use-mint-contract).
 * - EOA: empty capabilities — the user pays gas normally.
 *
 * The decision matrix lives in the pure function routePaymaster
 * (lib/paymaster-route.ts) so it is unit-testable without React mocks.
 */
export function usePaymasterCapabilities() {
  const { address, chainId } = useAccount()
  const { accountType } = useAccountType()
  const { data: available } = useCapabilities({
    account: address,
    // Skip the RPC capabilities probe entirely while disconnected.
    query: { enabled: !!address },
  })

  const paymasterProxyUrl = process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL

  const { capabilities, isPaymasterSupported, viaSmartAccount } =
    useMemo(() => {
      const decision = routePaymaster({
        accountType,
        chainId,
        available,
        paymasterProxyUrl,
      })
      switch (decision.kind) {
        case "smart-account":
          return {
            capabilities: {},
            isPaymasterSupported: true,
            viaSmartAccount: true,
          }
        case "coinbase":
          return {
            capabilities: decision.capabilities,
            isPaymasterSupported: true,
            viaSmartAccount: false,
          }
        case "eoa":
          return {
            capabilities: {},
            isPaymasterSupported: false,
            viaSmartAccount: false,
          }
      }
    }, [accountType, chainId, available, paymasterProxyUrl])

  return {
    capabilities,
    isPaymasterSupported,
    viaSmartAccount,
  }
}
