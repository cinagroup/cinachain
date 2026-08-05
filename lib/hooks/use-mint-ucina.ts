"use client"

import { useCallback, useEffect, useState } from "react"
import type { Hash } from "viem"
import { useSendCalls, useWaitForCallsStatus, useWaitForTransactionReceipt, useWriteContract } from "wagmi"

import { cinaMegaAbi, CINA_MEGA_CONTRACT } from "@/lib/contracts/cina-mega"
import { hasMegaContract } from "@/lib/contracts/addresses"
import { usePaymasterCapabilities } from "@/lib/hooks/use-paymaster"

export type MintUcinaStatus = "idle" | "awaiting-wallet" | "submitted" | "confirmed" | "reverted" | "error"

export interface UseMintUcinaResult {
  mintUcina: (amount: bigint) => Promise<Hash | undefined>
  status: MintUcinaStatus
  isPending: boolean
  isConfirmed: boolean
  error: string | null
  txHash: Hash | null
  isGasless: boolean
  reset: () => void
}

/**
 * Free public mint of the UCINA base unit. Gasless routing mirrors
 * use-mint-contract: Reown SA → writeContract (iframe UserOp), Coinbase →
 * EIP-5792 sendCalls + paymaster capability, EOA → writeContract.
 */
export function useMintUcina(): UseMintUcinaResult {
  const { writeContractAsync, isPending: writePending, error: writeError } = useWriteContract()
  const { sendCallsAsync, isPending: callsPending, error: callsError } = useSendCalls()
  const { capabilities, isPaymasterSupported, viaSmartAccount } = usePaymasterCapabilities()

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [callsId, setCallsId] = useState<string | null>(null)
  const [status, setStatus] = useState<MintUcinaStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const {
    data: callsStatus,
    isSuccess: callsResolved,
    isError: callsStatusFailed,
    error: callsStatusError,
  } = useWaitForCallsStatus({ id: callsId ?? undefined, query: { enabled: !!callsId } })

  const {
    isSuccess: receiptConfirmed,
    isError: receiptFailed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash ?? undefined, query: { enabled: !!txHash } })

  useEffect(() => {
    if (receiptConfirmed && status === "submitted") setStatus("confirmed")
    if (receiptFailed && status === "submitted") {
      setStatus("reverted")
      setError(receiptError?.message ?? "Transaction reverted")
    }
  }, [receiptConfirmed, receiptFailed, receiptError, status])

  useEffect(() => {
    if (!callsResolved || !callsId || status !== "submitted") return
    if (callsStatus?.status === "failure") {
      setStatus("reverted")
      setError("Calls failed — no transactions were confirmed")
      return
    }
    if (callsStatus?.status === "success") {
      const receipt = callsStatus.receipts?.[0]
      if (receipt?.status === "reverted") {
        setStatus("reverted")
        setError("Transaction reverted on-chain — no UCINA was minted")
        return
      }
      if (receipt?.transactionHash) setTxHash(receipt.transactionHash)
      else setStatus("confirmed")
    }
  }, [callsResolved, callsStatus, callsId, status])

  useEffect(() => {
    if (callsStatusFailed && status === "submitted") {
      setStatus("reverted")
      setError(callsStatusError?.message ?? "Failed to confirm calls")
    }
  }, [callsStatusFailed, callsStatusError, status])

  const extractError = (err: unknown): string => {
    if (err instanceof Error) {
      const anyErr = err as unknown as { shortMessage?: string; cause?: { reason?: string } }
      if (anyErr.shortMessage) return anyErr.shortMessage
      if (anyErr.cause?.reason) return anyErr.cause.reason
      return err.message
    }
    return "Unknown error"
  }

  const doMint = useCallback(
    async (amount: bigint): Promise<Hash | undefined> => {
      if (!hasMegaContract) {
        setStatus("error")
        setError("Mega contract not configured")
        return undefined
      }
      if (amount <= 0n) {
        setStatus("error")
        setError("Amount must be positive")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        const call = {
          to: CINA_MEGA_CONTRACT,
          abi: cinaMegaAbi,
          functionName: "mintUcina" as const,
          args: [amount] as const,
        }
        let batchId: string | undefined
        let hash: Hash | undefined
        if (isPaymasterSupported && !viaSmartAccount) {
          const sent = (await sendCallsAsync({ calls: [call], capabilities })) as { id: string }
          batchId = sent.id
        } else {
          hash = await writeContractAsync({
            address: call.to,
            abi: call.abi,
            functionName: call.functionName,
            args: call.args,
          })
        }
        if (batchId) setCallsId(batchId)
        if (hash) setTxHash(hash)
        setStatus("submitted")
        return (batchId ?? hash) as Hash | undefined
      } catch (err) {
        setStatus("error")
        setError(extractError(err))
        return undefined
      }
    },
    [writeContractAsync, sendCallsAsync, capabilities, isPaymasterSupported, viaSmartAccount]
  )

  const reset = useCallback(() => {
    setTxHash(null)
    setCallsId(null)
    setStatus("idle")
    setError(null)
  }, [])

  const isPending = writePending || callsPending || status === "awaiting-wallet" || status === "submitted"

  return {
    mintUcina: doMint,
    status,
    isPending,
    isConfirmed: status === "confirmed",
    error: error ?? (writeError ? extractError(writeError) : callsError ? extractError(callsError) : null),
    txHash,
    isGasless: isPaymasterSupported,
    reset,
  }
}
