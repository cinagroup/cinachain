"use client"

import { useEffect, useMemo, useState } from "react"
import { useAccount, useCapabilities } from "wagmi"

import type { AccountType } from "@/lib/paymaster-route"
import {
  isAppKitConfigured,
  subscribeEmbeddedWalletAccountType,
  type EmbeddedWalletAccountType,
} from "@/components/providers/appkit-provider"

export type { AccountType } from "@/lib/paymaster-route"

/**
 * Classify the connected account for gas/paymaster routing.
 * - "sa": Reown embedded-wallet smart account (ERC-4337) — AppKit's cloud
 *   iframe builds the UserOp and sponsors gas internally.
 * - "coinbase-smart-wallet": Coinbase Smart Wallet (EIP-5792 paymaster) —
 *   paymaster capabilities must be attached to sendCalls manually.
 * - "eoa": plain externally-owned account — user pays gas normally.
 * - null: not connected, or capabilities still loading (Coinbase vs EOA is
 *   not decided yet — avoids a momentary "eoa" misclassification).
 *
 * Detection (verified against @reown/appkit@1.8.23 + @reown/appkit-controllers):
 * - Reown SA: AppKit's account subscription reports
 *   `embeddedWalletInfo.accountType === "smartAccount"`. The subscription is
 *   initialized only when Reown is configured, keeping AppKit out of pages
 *   and deployments where its project id is intentionally absent.
 * - Coinbase Smart Wallet: EIP-5792 wallet_getCapabilities advertises
 *   paymasterService.supported for the active chain.
 */
export function useAccountType(): {
  accountType: AccountType | null
  isSmartAccount: boolean
} {
  const [embeddedWalletAccountType, setEmbeddedWalletAccountType] =
    useState<EmbeddedWalletAccountType>(null)
  const { address, chainId } = useAccount()
  const { data: available, isFetched: capsFetched } = useCapabilities({
    account: address,
    // Skip the RPC capabilities probe entirely while disconnected.
    query: { enabled: !!address },
  })

  useEffect(() => {
    if (!isAppKitConfigured) return

    let cancelled = false
    let unsubscribe: () => void = () => undefined
    void subscribeEmbeddedWalletAccountType((accountType) => {
      if (!cancelled) setEmbeddedWalletAccountType(accountType)
    }).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe()
        return
      }
      unsubscribe = nextUnsubscribe
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return useMemo(() => {
    if (!address) return { accountType: null, isSmartAccount: false }
    // Reown embedded-wallet smart account (ERC-4337) — checked first because
    // it is authoritative and does not rely on the capabilities probe.
    if (embeddedWalletAccountType === "smartAccount") {
      return { accountType: "sa", isSmartAccount: true }
    }
    // Wait for the capabilities probe before classifying Coinbase vs EOA,
    // otherwise a Coinbase Smart Wallet is briefly reported as "eoa".
    if (!capsFetched) return { accountType: null, isSmartAccount: false }
    // Coinbase Smart Wallet advertises EIP-5792 paymaster capabilities
    const chainCaps = available?.[chainId ?? 0]
    if (chainCaps?.paymasterService?.supported) {
      return { accountType: "coinbase-smart-wallet", isSmartAccount: true }
    }
    return { accountType: "eoa", isSmartAccount: false }
  }, [address, chainId, available, capsFetched, embeddedWalletAccountType])
}
