"use client"

import { useReadContracts } from "wagmi"
import { parseEther } from "viem"
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
      creditRate
        ? (parseEther(String(eth)) * creditRate) / 1_000_000_000_000_000_000n
        : 0n,
    // Credit is ERC-20 with 18 decimals; display the whole "credit" number
    formatBalance: (credit?: bigint) =>
      credit === undefined ? "—" : (Number(credit) / 1e18).toLocaleString(),
    // Raw (unscaled) credit values, e.g. ethToCredit output — show as-is
    formatCredit: (raw?: bigint) => (raw === undefined ? "—" : raw.toString()),
  }
}
