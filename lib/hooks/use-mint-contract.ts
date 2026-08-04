import { useCallback, useEffect, useState } from "react"
import { parseEther, type Hash } from "viem"
import {
  useSendCalls,
  useWaitForCallsStatus,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"

import { CINA_NFT_CONTRACT, MINT_PRICE_ETH } from "@/lib/contracts/addresses"
import { usePaymasterCapabilities } from "@/lib/hooks/use-paymaster"

const MINT_ABI = [
  {
    name: "mintWhitelist",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes32[]" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "mintPublic",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
] as const

export type MintStatus =
  | "idle"
  | "preparing"
  | "awaiting-wallet"
  | "submitted"
  | "confirmed"
  | "reverted"
  | "error"

export interface UseMintContractResult {
  mintWhitelist: (
    proof: string[],
    quantity: number
  ) => Promise<Hash | undefined>
  mintPublic: (
    quantity: number,
    pricePerNftWei?: bigint
  ) => Promise<Hash | undefined>
  status: MintStatus
  isPending: boolean
  isConfirmed: boolean
  error: string | null
  txHash: Hash | null
  reset: () => void
  isGasless: boolean
}

/** Contract's MAX_PER_ADDRESS — mirrors CinaNFT.sol */
const MAX_PUBLIC_PER_TX = 10

/**
 * NFT 铸造合约交互 hook
 * - 返回交易 hash，便于 UI 显示
 * - 自动等待交易回执
 * - 捕获 revert 原因
 *
 * Gasless paths (routed by usePaymasterCapabilities):
 * - Coinbase Smart Wallet: EIP-5792 sendCalls with the paymaster URL.
 *   Plain writeContract does NOT forward `capabilities` to the wallet
 *   (viem types confirm it only exists on sendCalls), so a separate
 *   sendCalls path is required — otherwise the paymaster URL is silently
 *   dropped and the user pays gas normally.
 * - Reown smart account ("sa", viaSmartAccount): AppKit's cloud iframe
 *   builds the UserOp and sponsors gas internally; manual capabilities are
 *   empty, so the mint goes through plain writeContract (eth_sendTransaction)
 *   which the iframe transparently converts into a UserOp.
 * - EOA: plain writeContract — the user pays gas normally.
 */
export function useMintContract(): UseMintContractResult {
  const {
    writeContractAsync,
    isPending: writePending,
    error: writeError,
  } = useWriteContract()
  const {
    sendCallsAsync,
    isPending: callsPending,
    error: callsError,
  } = useSendCalls()
  const { capabilities, isPaymasterSupported, viaSmartAccount } =
    usePaymasterCapabilities()

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [callsId, setCallsId] = useState<string | null>(null)
  const [status, setStatus] = useState<MintStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  // EIP-5792: sendCalls returns an opaque batch id, not a tx hash. For the
  // Coinbase Smart Wallet gasless path we must poll wallet_getCallsStatus and
  // only then resolve the real on-chain transaction hash from the receipts.
  const {
    data: callsStatus,
    isSuccess: callsResolved,
    isError: callsStatusFailed,
    error: callsStatusError,
  } = useWaitForCallsStatus({
    id: callsId ?? undefined,
    query: { enabled: !!callsId },
  })

  const {
    isSuccess: receiptConfirmed,
    isError: receiptFailed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  // Sync receipt state via useEffect (not during render)
  useEffect(() => {
    if (receiptConfirmed && status === "submitted") setStatus("confirmed")
    if (receiptFailed && status === "submitted") {
      setStatus("reverted")
      setError(receiptError?.message ?? "Transaction reverted")
    }
  }, [receiptConfirmed, receiptFailed, receiptError, status])

  // EIP-5792 batch resolution: map wallet_getCallsStatus to our states. A
  // "success" batch may still contain a reverted receipt (e.g. a mint that
  // failed in the contract but was sponsored through); surface it as such.
  useEffect(() => {
    if (!callsResolved || !callsId) return
    if (callsStatus?.status === "failure") {
      if (status === "submitted") {
        setStatus("reverted")
        setError("Calls failed — no transactions were confirmed")
      }
      return
    }
    if (callsStatus?.status === "success") {
      const receipt = callsStatus.receipts?.[0]
      if (receipt?.status === "reverted") {
        if (status === "submitted") {
          setStatus("reverted")
          setError("Transaction reverted on-chain — no NFT was minted")
        }
        return
      }
      // Resolve the real transaction hash for the explorer link + receipt
      // wait. The receipt already exists on-chain, so the wait resolves
      // immediately; keeping txHash also preserves the basescan link.
      if (receipt?.transactionHash) {
        setTxHash(receipt.transactionHash)
      } else if (status === "submitted") {
        // Batch succeeded but the wallet didn't surface receipts — still a
        // successful submission, don't let it linger as "submitted" forever.
        setStatus("confirmed")
      }
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
      // viem/wagmi 错误通常带 shortMessage
      const anyErr = err as unknown as {
        shortMessage?: string
        cause?: { reason?: string }
      }
      if (anyErr.shortMessage) return anyErr.shortMessage
      if (anyErr.cause?.reason) return anyErr.cause.reason
      return err.message
    }
    return "Unknown error"
  }

  const assertConfigured = (): boolean => {
    if (
      !CINA_NFT_CONTRACT ||
      CINA_NFT_CONTRACT === "0x0000000000000000000000000000000000000000"
    ) {
      setError("NFT contract address not configured")
      setStatus("error")
      return false
    }
    return true
  }

  const doMintWhitelist = useCallback(
    async (proof: string[], quantity: number): Promise<Hash | undefined> => {
      if (!assertConfigured()) return undefined
      if (!Number.isInteger(quantity) || quantity < 1) {
        setError("Quantity must be a positive integer")
        setStatus("error")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        const call = {
          to: CINA_NFT_CONTRACT,
          abi: MINT_ABI,
          functionName: "mintWhitelist" as const,
          args: [proof as readonly `0x${string}`[], BigInt(quantity)] as [
            readonly `0x${string}`[],
            bigint
          ],
        }
        // Gasless: sendCalls carries the paymaster capability; otherwise the
        // plain write path (EOA pays gas normally; Reown smart accounts are
        // routed through writeContract too — the iframe converts it to a
        // UserOp with AppKit's internal paymaster).
        // sendCalls resolves to an EIP-5792 batch id — the real tx hash is
        // obtained from wallet_getCallsStatus (see the effect above).
        let batchId: string | undefined
        let hash: Hash | undefined
        if (isPaymasterSupported && !viaSmartAccount) {
          const sent = (await sendCallsAsync({
            calls: [call],
            capabilities,
          })) as { id: string }
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
        // For the EIP-5792 path the real hash is not known until
        // wallet_getCallsStatus resolves; return the batch id for now.
        return (batchId ?? hash) as Hash | undefined
      } catch (err) {
        setStatus("error")
        setError(extractError(err))
        return undefined
      }
    },
    [
      writeContractAsync,
      sendCallsAsync,
      capabilities,
      isPaymasterSupported,
      viaSmartAccount,
    ]
  )

  const doMintPublic = useCallback(
    async (
      quantity: number,
      pricePerNftWei?: bigint
    ): Promise<Hash | undefined> => {
      if (!assertConfigured()) return undefined
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_PUBLIC_PER_TX
      ) {
        setError(
          `Quantity must be an integer between 1 and ${MAX_PUBLIC_PER_TX}`
        )
        setStatus("error")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        // Prefer the on-chain mintPrice (passed by the mint page); fall back
        // to the env constant so the sent value always matches the contract.
        const priceWei = pricePerNftWei ?? parseEther(String(MINT_PRICE_ETH))
        const call = {
          to: CINA_NFT_CONTRACT,
          abi: MINT_ABI,
          functionName: "mintPublic" as const,
          args: [BigInt(quantity)] as [bigint],
          value: priceWei * BigInt(quantity),
        }
        let batchId: string | undefined
        let hash: Hash | undefined
        if (isPaymasterSupported && !viaSmartAccount) {
          const sent = (await sendCallsAsync({
            calls: [call],
            capabilities,
          })) as { id: string }
          batchId = sent.id
        } else {
          hash = await writeContractAsync({
            address: call.to,
            abi: call.abi,
            functionName: call.functionName,
            args: call.args,
            value: call.value,
          })
        }
        if (batchId) setCallsId(batchId)
        if (hash) setTxHash(hash)
        setStatus("submitted")
        // For the EIP-5792 path the real hash is not known until
        // wallet_getCallsStatus resolves; return the batch id for now.
        return (batchId ?? hash) as Hash | undefined
      } catch (err) {
        setStatus("error")
        setError(extractError(err))
        return undefined
      }
    },
    [
      writeContractAsync,
      sendCallsAsync,
      capabilities,
      isPaymasterSupported,
      viaSmartAccount,
    ]
  )

  const reset = useCallback(() => {
    setTxHash(null)
    setCallsId(null)
    setStatus("idle")
    setError(null)
  }, [])

  const isPending =
    writePending ||
    callsPending ||
    status === "awaiting-wallet" ||
    status === "submitted" ||
    status === "preparing"

  return {
    mintWhitelist: doMintWhitelist,
    mintPublic: doMintPublic,
    status,
    isPending,
    isConfirmed: status === "confirmed",
    error:
      error ??
      (writeError
        ? extractError(writeError)
        : callsError
        ? extractError(callsError)
        : null),
    txHash,
    reset,
    isGasless: isPaymasterSupported,
  }
}
