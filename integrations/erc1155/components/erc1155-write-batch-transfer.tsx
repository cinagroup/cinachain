import { useState } from "react"
import { useForm } from "react-hook-form"
import { useDebounceValue } from "usehooks-ts"
import { type Address, type BaseError } from "viem"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"

import { useI18n } from "@/lib/i18n"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ContractWriteButton } from "@/components/blockchain/contract-write-button"
import { TransactionStatus } from "@/components/blockchain/transaction-status"

import {
  useSimulateErc1155SafeBatchTransferFrom,
  useWriteErc1155SafeBatchTransferFrom,
} from "../generated/erc1155-wagmi"

interface Erc1155WriteTransferProps {
  address: Address
}

export function Erc1155WriteBatchTransfer({
  address,
}: Erc1155WriteTransferProps) {
  const { t } = useI18n()
  const { register, watch, handleSubmit } = useForm()
  const [batchNumber, setBatchNumber] = useState<number>(2)

  const batchFields = []
  const tokenIdArr = []
  const amountArr = []
  for (let i = 1; i <= batchNumber; i++) {
    batchFields.push(
      <>
        <label>
          {t("integration.field.tokenId")} ({t("integration.field.batchNumber")}
          : {i}){" "}
        </label>
        <input
          type="number"
          {...register("tokenId" + i.toString())}
          className="input"
        />
        <label>
          {t("integration.field.amount")} ({t("integration.field.batchNumber")}:{" "}
          {i})
        </label>
        <input
          type="number"
          {...register("amount" + i.toString())}
          className="input"
        />
      </>
    )

    const watchTokenId: string = watch("tokenId" + i.toString())
    tokenIdArr.push(watchTokenId)
    const watchAmount: string = watch("amount" + i.toString())
    amountArr.push(watchAmount)
  }

  const watchDifferentFromAddress: boolean = watch("differentFromAddress")
  const watchFromAddress: Address = watch("fromAddress")
  const watchToAddress: Address = watch("toAddress")

  const [debouncedFromAddress] = useDebounceValue(watchFromAddress, 500)
  const [debouncedToAddress] = useDebounceValue(watchToAddress, 500)
  const [debouncedTokenIdArr] = useDebounceValue(tokenIdArr, 500)
  const [debouncedAmountArr] = useDebounceValue(amountArr, 500)

  const { address: accountAddress } = useAccount()

  const transferFromAddress = watchDifferentFromAddress
    ? debouncedFromAddress
    : accountAddress

  const isTokenIdArrValid = !debouncedTokenIdArr.reduce(
    (acc, val) => acc || !val || val.trim() === "",
    false
  )
  const isAmountArrValid = !debouncedAmountArr.reduce(
    (acc, val) => acc || !val || val.trim() === "",
    false
  )

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc1155SafeBatchTransferFrom({
    address,
    args:
      transferFromAddress &&
      debouncedToAddress &&
      isTokenIdArrValid &&
      isAmountArrValid
        ? [
            transferFromAddress,
            debouncedToAddress,
            debouncedTokenIdArr.map((id) => BigInt(id)),
            debouncedAmountArr.map((num) => BigInt(num)),
            "0x",
          ]
        : undefined,
    query: {
      enabled: Boolean(
        transferFromAddress &&
          debouncedToAddress &&
          isTokenIdArrValid &&
          isAmountArrValid
      ),
    },
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc1155SafeBatchTransferFrom()

  const { isLoading: isLoadingTx, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  })

  const onSubmit = () => {
    writeContract?.(config!.request)
  }

  return (
    <Card>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex items-center justify-between text-sm">
            <label>{t("integration.field.useDifferentFrom")}</label>
            <div className="size-6">
              <input
                {...register("differentFromAddress")}
                className="input"
                type="checkbox"
              />
            </div>
          </div>
          {watchDifferentFromAddress && (
            <>
              <label>{t("integration.field.fromAddress")}</label>
              <input {...register("fromAddress")} className="input" />
            </>
          )}
          <label>{t("integration.field.toAddress")}</label>
          <input {...register("toAddress")} className="input" />
          <label>{t("integration.field.batchNumber")}</label>
          <input
            className="input"
            type="number"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.valueAsNumber)}
          />
          {batchFields}
          <ContractWriteButton
            isLoadingTx={isLoadingTx}
            isLoadingWrite={isLoadingWrite}
            loadingTxText={t("integration.action.transferring")}
            type="submit"
            write={!!writeContract}
          >
            {t("integration.action.batchTransfer")}
          </ContractWriteButton>
          <TransactionStatus
            error={error as BaseError}
            hash={data}
            isError={isError && Boolean(isTokenIdArrValid && isAmountArrValid)}
            isLoadingTx={isLoadingTx}
            isSuccess={isSuccess}
          />
        </form>
      </CardContent>
      <Separator className="my-4" />
      <CardFooter className="justify-between">
        <h3 className="text-center">
          {t("integration.cardTitle", {
            standard: "ERC-1155",
            action: t("integration.action.batchTransfer"),
          })}
        </h3>
        <p className="text-center text-sm text-gray-500">
          {t("integration.batchTransferDescription", { standard: "ERC-1155" })}
        </p>
      </CardFooter>
    </Card>
  )
}
