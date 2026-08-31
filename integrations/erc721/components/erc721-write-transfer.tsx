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
  useSimulateErc721SafeTransferFrom,
  useWriteErc721SafeTransferFrom,
} from "../generated/erc721-wagmi"

interface Erc721WriteTransferProps {
  address: Address
}

export function Erc721WriteTransfer({ address }: Erc721WriteTransferProps) {
  const { t } = useI18n()
  const { register, watch, handleSubmit } = useForm()

  const watchDifferentFromAddress: boolean = watch("differentFromAddress")
  const watchTokenId: string = watch("tokenId")
  const watchFromAddress: Address = watch("fromAddress")
  const watchToAddress: Address = watch("toAddress")
  const [debouncedTokenId] = useDebounceValue(watchTokenId, 500)
  const [debouncedFromAddress] = useDebounceValue(watchFromAddress, 500)
  const [debouncedToAddress] = useDebounceValue(watchToAddress, 500)

  const { address: accountAddress } = useAccount()

  const transferFromAddress = watchDifferentFromAddress
    ? debouncedFromAddress
    : accountAddress

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc721SafeTransferFrom({
    address,
    args:
      transferFromAddress && debouncedToAddress && debouncedTokenId
        ? [transferFromAddress, debouncedToAddress, BigInt(debouncedTokenId)]
        : undefined,
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc721SafeTransferFrom()

  const { isLoading: isLoadingTx, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  })

  const onSubmit = () => {
    if (config?.request) {
      writeContract?.(config.request as any)
    }
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
          <label>{t("integration.field.tokenId")}</label>
          <input type="number" {...register("tokenId")} className="input" />
          <ContractWriteButton
            isLoadingTx={isLoadingTx}
            isLoadingWrite={isLoadingWrite}
            loadingTxText={t("integration.action.transferring")}
            type="submit"
            write={!!writeContract}
          >
            {t("integration.action.transfer")}
          </ContractWriteButton>
          <TransactionStatus
            error={error as BaseError}
            hash={data}
            isError={isError}
            isLoadingTx={isLoadingTx}
            isSuccess={isSuccess}
          />
        </form>
      </CardContent>
      <Separator className="my-4" />
      <CardFooter className="justify-between">
        <h3 className="text-center">
          {t("integration.cardTitle", {
            standard: "ERC-721",
            action: t("integration.action.transfer"),
          })}
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          {t("integration.transferAnyDescription", { standard: "NFT" })}
        </p>
      </CardFooter>
    </Card>
  )
}
