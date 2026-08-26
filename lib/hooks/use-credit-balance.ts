"use client"

import { useReadContracts } from "wagmi"
import { CINA_CREDIT_CONTRACT, hasCreditContract } from "@/lib/contracts/addresses"
import { CINA_CREDIT_ABI } from "@/lib/contracts/cina-credit"

/** CinaCreditV2 balance + supply + pause state for the connected wallet */
export function useCreditBalance(address?: `0x${string}`) {
  const result = useReadContracts({
    contracts: [
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "balanceOf", args: address ? [address] : undefined },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "totalSupply" },
      { address: CINA_CREDIT_CONTRACT, abi: CINA_CREDIT_ABI, functionName: "paused" },
    ],
    query: { enabled: hasCreditContract },
  })

  const [balance, supply, paused] = result.data ?? []
  const ok = (r?: { status?: string; result?: unknown }) =>
    r && r.status === "success" ? r.result : undefined

  const creditBalance = ok(balance) as bigint | undefined
  const totalSupply = ok(supply) as bigint | undefined
  const isPaused = ok(paused) === true

  return {
    creditBalance,
    totalSupply,
    isPaused,
    isLoading: result.isLoading,
    // Credit is ERC-20 with 18 decimals; display the whole "credit" number
    formatBalance: (credit?: bigint) =>
      credit === undefined ? "—" : (Number(credit) / 1e18).toLocaleString(),
  }
}
