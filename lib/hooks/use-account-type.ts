"use client"

import { useMemo } from "react"
import { useAppKitAccount } from "@reown/appkit/react"
import { useAccount, useCapabilities } from "wagmi"

import type { AccountType } from "@/lib/paymaster-route"

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
 * - Reown SA: official API `useAppKitAccount().embeddedWalletInfo.accountType
 *   === "smartAccount"`. embeddedWalletInfo is populated only while the
 *   embedded-wallet auth connector is the active connector, and accountType
 *   reflects the user's preferred/active account type ("eoa" | "smartAccount").
 *   No localStorage sniffing needed — the official hook takes precedence.
 * - Coinbase Smart Wallet: EIP-5792 wallet_getCapabilities advertises
 *   paymasterService.supported for the active chain.
 */
export function useAccountType(): {
  accountType: AccountType | null
  isSmartAccount: boolean
} {
  const { address, chainId } = useAccount()
  const { data: available, isFetched: capsFetched } = useCapabilities({
    account: address,
    // Skip the RPC capabilities probe entirely while disconnected.
    query: { enabled: !!address },
  })
  const { embeddedWalletInfo } = useAppKitAccount()

  return useMemo(() => {
    if (!address) return { accountType: null, isSmartAccount: false }
    // Reown embedded-wallet smart account (ERC-4337) — checked first because
    // it is authoritative and does not rely on the capabilities probe.
    if (embeddedWalletInfo?.accountType === "smartAccount") {
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
  }, [address, chainId, available, capsFetched, embeddedWalletInfo])
}
