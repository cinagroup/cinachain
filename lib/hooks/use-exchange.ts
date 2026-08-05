"use client"

import { useCallback, useEffect, useState } from "react"
import type { Hash } from "viem"
import { useSendCalls, useWaitForCallsStatus, useWaitForTransactionReceipt, useWriteContract } from "wagmi"

import { cinaMegaAbi, CINA_MEGA_CONTRACT } from "@/lib/contracts/cina-mega"
import { hasMegaContract } from "@/lib/contracts/addresses"
import { usePaymasterCapabilities } from "@/lib/hooks/use-paymaster"
import { extractErrorMessage } from "@/lib/error-utils"

export type ExchangeStatus =
  | "idle"
  | "awaiting-wallet"
  | "submitted"
  | "confirmed"
  | "reverted"
  | "error"

export interface UseExchangeResult {
  exchange: (fromType: bigint, toType: bigint, amount: bigint) => Promise<Hash | undefined>
  status: ExchangeStatus
  isPending: boolean
  isConfirmed: boolean
  error: string | null
  txHash: Hash | null
  reset: () => void
  isGasless: boolean
}

/**
 * CinaMega bidirectional exchange. Gasless routing mirrors use-mint-contract:
 * - Reown smart account: plain writeContract (iframe converts to UserOp)
 * - Coinbase Smart Wallet: EIP-5792 sendCalls with the paymaster capability
 * - EOA: plain writeContract (user pays gas)
 */
export function useExchange(): UseExchangeResult {
  const { writeContractAsync, isPending: writePending, error: writeError } = useWriteContract()
  const { sendCallsAsync, isPending: callsPending, error: callsError } = useSendCalls()
  const { capabilities, isPaymasterSupported, viaSmartAccount } = usePaymasterCapabilities()

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [callsId, setCallsId] = useState<string | null>(null)
  const [status, setStatus] = useState<ExchangeStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  // EIP-5792: sendCalls resolves to a batch id — poll wallet_getCallsStatus
  // and resolve the real transaction hash from the receipts.
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
        setError("Transaction reverted on-chain — nothing was exchanged")
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

  const doExchange = useCallback(
    async (fromType: bigint, toType: bigint, amount: bigint): Promise<Hash | undefined> => {
      if (!hasMegaContract) {
        setStatus("error")
        setError("Mega contract not configured")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        const call = {
          to: CINA_MEGA_CONTRACT,
          abi: cinaMegaAbi,
          functionName: "exchange" as const,
          args: [fromType, toType, amount] as const,
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
        setError(extractErrorMessage(err))
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
    exchange: doExchange,
    status,
    isPending,
    isConfirmed: status === "confirmed",
    error: error ?? (writeError ? extractErrorMessage(writeError) : callsError ? extractErrorMessage(callsError) : null),
    txHash,
    reset,
    isGasless: isPaymasterSupported,
  }
}
