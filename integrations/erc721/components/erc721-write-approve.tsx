import { useForm } from "react-hook-form"
import { useDebounceValue } from "usehooks-ts"
import { type Address, type BaseError } from "viem"
import { useWaitForTransactionReceipt } from "wagmi"

import { useI18n } from "@/lib/i18n"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ContractWriteButton } from "@/components/blockchain/contract-write-button"
import { TransactionStatus } from "@/components/blockchain/transaction-status"

import {
  useSimulateErc721Approve,
  useWriteErc721Approve,
} from "../generated/erc721-wagmi"

interface Erc721WriteApproveProps {
  address: Address
}

export function Erc721WriteApprove({ address }: Erc721WriteApproveProps) {
  const { t } = useI18n()
  const { register, handleSubmit, watch } = useForm()
  const watchToAddress: Address = watch("toAddress")
  const watchTokenId: string = watch("tokenId")
  const [debouncedToAddress] = useDebounceValue(watchToAddress, 500)
  const [debouncedTokenId] = useDebounceValue(watchTokenId, 500)

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc721Approve({
    address,
    args:
      debouncedToAddress && debouncedTokenId
        ? [debouncedToAddress, BigInt(debouncedTokenId)]
        : undefined,
    query: {
      enabled: Boolean(debouncedToAddress && debouncedTokenId),
    },
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc721Approve()

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
          <label>{t("integration.field.address")}</label>
          <input {...register("toAddress")} className="input" />
          <label>{t("integration.field.tokenId")}</label>
          <input type="number" {...register("tokenId")} className="input" />
          <ContractWriteButton
            isLoadingTx={isLoadingTx}
            isLoadingWrite={isLoadingWrite}
            loadingTxText={t("integration.action.approving")}
            type="submit"
            write={!!writeContract}
          >
            {t("integration.action.approve")}
          </ContractWriteButton>
          <TransactionStatus
            error={error as BaseError}
            hash={data}
            isError={isError && Boolean(debouncedToAddress && debouncedTokenId)}
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
            action: t("integration.action.approve"),
          })}
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          {t("integration.approveAnyDescription")}
        </p>
      </CardFooter>
    </Card>
  )
}
