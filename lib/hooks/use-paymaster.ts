"use client"

import { useMemo } from "react"
import { useAccount, useCapabilities } from "wagmi"

/**
 * Detects if the connected wallet supports EIP-5792 paymaster service
 * (Coinbase Smart Wallet on Base). Returns capabilities object to attach
 * to writeContract calls for gasless transactions.
 *
 * For EOA wallets (MetaMask, etc.), returns empty capabilities —
 * the user pays gas normally. No behavior change.
 */
export function usePaymasterCapabilities() {
  const { address, chainId } = useAccount()
  const { data: available } = useCapabilities({ account: address })

  const paymasterProxyUrl = process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL

  const { capabilities, isPaymasterSupported } = useMemo(() => {
    if (!available || !chainId || !paymasterProxyUrl) {
      return { capabilities: {}, isPaymasterSupported: false }
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
      }
    }

    return { capabilities: {}, isPaymasterSupported: false }
  }, [available, chainId, paymasterProxyUrl])

  return {
    capabilities,
    isPaymasterSupported,
  }
}
