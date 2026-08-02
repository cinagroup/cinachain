import { useState, useCallback } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, type Hash } from "viem"
import { CINA_NFT_CONTRACT, MINT_PRICE_ETH } from "@/lib/contracts/addresses"

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
  mintWhitelist: (proof: string[], quantity: number) => Promise<Hash | undefined>
  mintPublic: (quantity: number) => Promise<Hash | undefined>
  status: MintStatus
  isPending: boolean
  isConfirmed: boolean
  error: string | null
  txHash: Hash | null
  reset: () => void
}

/**
 * NFT 铸造合约交互 hook
 * - 返回交易 hash，便于 UI 显示
 * - 自动等待交易回执
 * - 捕获 revert 原因
 */
export function useMintContract(): UseMintContractResult {
  const { writeContractAsync, isPending: writePending, error: writeError } =
    useWriteContract()

  const [txHash, setTxHash] = useState<Hash | null>(null)
  const [status, setStatus] = useState<MintStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const {
    isSuccess: receiptConfirmed,
    isError: receiptFailed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: !!txHash },
  })

  // 同步交易回执状态
  if (receiptConfirmed && status === "submitted") setStatus("confirmed")
  if (receiptFailed && status === "submitted") {
    setStatus("reverted")
    setError(receiptError?.message ?? "Transaction reverted")
  }

  const extractError = (err: unknown): string => {
    if (err instanceof Error) {
      // viem/wagmi 错误通常带 shortMessage
      const anyErr = err as unknown as { shortMessage?: string; cause?: { reason?: string } }
      if (anyErr.shortMessage) return anyErr.shortMessage
      if (anyErr.cause?.reason) return anyErr.cause.reason
      return err.message
    }
    return "Unknown error"
  }

  const doMintWhitelist = useCallback(
    async (proof: string[], quantity: number): Promise<Hash | undefined> => {
      if (!CINA_NFT_CONTRACT || CINA_NFT_CONTRACT === "0x0000000000000000000000000000000000000000") {
        setError("NFT contract address not configured")
        setStatus("error")
        return undefined
      }
      if (quantity < 1) {
        setError("Quantity must be at least 1")
        setStatus("error")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        const hash = await writeContractAsync({
          address: CINA_NFT_CONTRACT,
          abi: MINT_ABI,
          functionName: "mintWhitelist",
          args: [proof as readonly `0x${string}`[], BigInt(quantity)],
        })
        setTxHash(hash)
        setStatus("submitted")
        return hash
      } catch (err) {
        setStatus("error")
        setError(extractError(err))
        return undefined
      }
    },
    [writeContractAsync]
  )

  const doMintPublic = useCallback(
    async (quantity: number): Promise<Hash | undefined> => {
      if (!CINA_NFT_CONTRACT || CINA_NFT_CONTRACT === "0x0000000000000000000000000000000000000000") {
        setError("NFT contract address not configured")
        setStatus("error")
        return undefined
      }
      if (quantity < 1) {
        setError("Quantity must be at least 1")
        setStatus("error")
        return undefined
      }
      setStatus("awaiting-wallet")
      setError(null)
      try {
        const hash = await writeContractAsync({
          address: CINA_NFT_CONTRACT,
          abi: MINT_ABI,
          functionName: "mintPublic",
          args: [BigInt(quantity)],
          value: parseEther(String(MINT_PRICE_ETH)) * BigInt(quantity),
        })
        setTxHash(hash)
        setStatus("submitted")
        return hash
      } catch (err) {
        setStatus("error")
        setError(extractError(err))
        return undefined
      }
    },
    [writeContractAsync]
  )

  const reset = useCallback(() => {
    setTxHash(null)
    setStatus("idle")
    setError(null)
  }, [])

  const isPending =
    writePending ||
    status === "awaiting-wallet" ||
    status === "submitted" ||
    status === "preparing"

  return {
    mintWhitelist: doMintWhitelist,
    mintPublic: doMintPublic,
    status,
    isPending,
    isConfirmed: status === "confirmed",
    error: error ?? (writeError ? extractError(writeError) : null),
    txHash,
    reset,
  }
}
