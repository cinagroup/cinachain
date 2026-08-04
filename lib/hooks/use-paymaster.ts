"use client"

import { useMemo } from "react"
import { useAccount, useCapabilities } from "wagmi"

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
      if (accountType === "sa") {
        // AppKit's smart-account flow handles UserOp + paymaster internally;
        // no manual capabilities needed — mark the path for callers.
        return {
          capabilities: {},
          isPaymasterSupported: true,
          viaSmartAccount: true,
        }
      }
      if (!available || !chainId || !paymasterProxyUrl) {
        return {
          capabilities: {},
          isPaymasterSupported: false,
          viaSmartAccount: false,
        }
      }
      const chainCaps = available[chainId]
      if (chainCaps?.paymasterService?.supported) {
        return {
          capabilities: {
            paymasterService: {
              url: paymasterProxyUrl,
            },
          },
          isPaymasterSupported: true,
          viaSmartAccount: false,
        }
      }
      return {
        capabilities: {},
        isPaymasterSupported: false,
        viaSmartAccount: false,
      }
    }, [accountType, available, chainId, paymasterProxyUrl])

  return {
    capabilities,
    isPaymasterSupported,
    viaSmartAccount,
  }
}
