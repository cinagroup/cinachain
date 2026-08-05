"use client"

import { useReadContracts } from "wagmi"

import { cinaMegaAbi, CINA_MEGA_CONTRACT } from "@/lib/contracts/cina-mega"
import { hasMegaContract } from "@/lib/contracts/addresses"
import { MEGA_TYPES } from "@/lib/exchange"

export interface CinaMegaBalances {
  [type: number]: bigint // 1 = ucina, 2 = mcina, 3 = cina
}

/** Reads all three balances for the connected account (one multicall). */
export function useCinaMegaBalances(address: `0x${string}` | undefined) {
  const ids = MEGA_TYPES.map((t) => BigInt(t))
  const { data, isLoading, isError } = useReadContracts({
    contracts: address
      ? ids.map((id) => ({
          address: CINA_MEGA_CONTRACT,
          abi: cinaMegaAbi,
          functionName: "balanceOfBatch" as const,
          args: [ids.map(() => address), [id]] as const,
        }))
      : undefined,
    query: { enabled: !!address && hasMegaContract },
  })

  const balances: CinaMegaBalances = { 1: 0n, 2: 0n, 3: 0n }
  for (let i = 0; i < MEGA_TYPES.length; i++) {
    const r = data?.[i]
    if (r?.status === "success" && r.result?.[0] !== undefined) {
      balances[MEGA_TYPES[i]] = r.result[0]
    }
  }
  return { balances, isLoading, isError }
}

export interface CinaMegaMeta {
  cids: Record<number, string> // type → dir CID
  mintCapPerAddress: bigint | null
  svgLocked: boolean | null
  paused: boolean | null
  isLoading: boolean
  isError: boolean
}

/** Reads collection-level metadata (CIDs, mint cap, lock/pause state). */
export function useCinaMegaMeta(): CinaMegaMeta {
  const contracts = [
    ...MEGA_TYPES.map((t) => ({
      address: CINA_MEGA_CONTRACT,
      abi: cinaMegaAbi,
      functionName: "typeCid" as const,
      args: [BigInt(t)] as const,
    })),
    { address: CINA_MEGA_CONTRACT, abi: cinaMegaAbi, functionName: "mintCapPerAddress" as const },
    { address: CINA_MEGA_CONTRACT, abi: cinaMegaAbi, functionName: "svgLocked" as const },
    { address: CINA_MEGA_CONTRACT, abi: cinaMegaAbi, functionName: "paused" as const },
  ]
  const { data, isLoading, isError } = useReadContracts({
    contracts: hasMegaContract ? contracts : undefined,
    query: { enabled: hasMegaContract },
  })

  const cids: Record<number, string> = { 1: "", 2: "", 3: "" }
  for (let i = 0; i < MEGA_TYPES.length; i++) {
    const r = data?.[i]
    if (r?.status === "success") cids[MEGA_TYPES[i]] = String(r.result ?? "")
  }
  return {
    cids,
    mintCapPerAddress: data?.[3]?.status === "success" ? (data[3].result as bigint) : null,
    svgLocked: data?.[4]?.status === "success" ? Boolean(data[4].result) : null,
    paused: data?.[5]?.status === "success" ? Boolean(data[5].result) : null,
    isLoading,
    isError,
  }
}
