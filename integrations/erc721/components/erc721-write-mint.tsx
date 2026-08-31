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
  useSimulateErc721SafeMint,
  useWriteErc721SafeMint,
} from "../generated/erc721-wagmi"

interface Erc721WriteMintProps {
  address: Address
}

interface FormSchema {
  toAddress: Address
  tokenId: string
  tokenUri: string
}

export function Erc721WriteMint({ address }: Erc721WriteMintProps) {
  const { t } = useI18n()
  const { register, watch, handleSubmit } = useForm<FormSchema>()

  const [debouncedToAddress] = useDebounceValue(watch("toAddress"), 500)
  const [debouncedTokenId] = useDebounceValue(watch("tokenId"), 500)
  const [debouncedTokenUri] = useDebounceValue(watch("tokenUri"), 500)

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc721SafeMint({
    address,
    args:
      debouncedToAddress && debouncedTokenId && debouncedTokenUri
        ? [debouncedToAddress, BigInt(debouncedTokenId || 0), debouncedTokenUri]
        : undefined,
    query: {
      enabled: Boolean(
        debouncedToAddress && debouncedTokenId && debouncedTokenUri
      ),
    },
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc721SafeMint()

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
          <input {...register("tokenId")} className="input" type="number" />
          <label>{t("integration.field.tokenUri")}</label>
          <input {...register("tokenUri")} className="input" />
          <ContractWriteButton
            isLoadingTx={isLoadingTx}
            isLoadingWrite={isLoadingWrite}
            loadingTxText={t("integration.action.minting")}
            type="submit"
            write={!!writeContract}
          >
            {t("integration.action.mint")}
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
            action: t("integration.action.mint"),
          })}
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          {t("integration.mintAnyDescription", { standard: "NFT" })}
        </p>
      </CardFooter>
    </Card>
  )
}
