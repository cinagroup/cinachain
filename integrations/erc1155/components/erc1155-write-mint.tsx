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
  useSimulateErc1155Mint,
  useWriteErc1155Mint,
} from "../generated/erc1155-wagmi"

interface Erc1155WriteMintProps {
  address: Address
}

interface FormSchema {
  toAddress: Address
  tokenId: string
  tokenAmount: string
  uri: string
}

export function Erc1155WriteMint({ address }: Erc1155WriteMintProps) {
  const { t } = useI18n()
  const { register, watch, handleSubmit } = useForm<FormSchema>()

  const watchToAddress = watch("toAddress")
  const watchTokenId = watch("tokenId")
  const watchTokenAmount = watch("tokenAmount")
  const watchUri = watch("uri")
  const [debouncedToAddress] = useDebounceValue(watchToAddress, 500)
  const [debouncedTokenId] = useDebounceValue(watchTokenId, 500)
  const [debouncedTokenAmount] = useDebounceValue(watchTokenAmount, 500)
  const [debouncedUri] = useDebounceValue(watchUri, 500)

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc1155Mint({
    address,
    args:
      debouncedToAddress &&
      debouncedTokenId &&
      debouncedTokenAmount &&
      debouncedUri
        ? [
            debouncedToAddress,
            BigInt(debouncedTokenId || 0),
            BigInt(debouncedTokenAmount),
            debouncedUri,
          ]
        : undefined,
    query: {
      enabled: Boolean(
        debouncedToAddress &&
          debouncedTokenId &&
          debouncedTokenAmount &&
          debouncedUri
      ),
    },
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc1155Mint()

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
          <label>{t("integration.field.tokenAmount")}</label>
          <input {...register("tokenAmount")} className="input" />
          <label>{t("integration.field.uri")}</label>
          <input
            {...register("uri")}
            className="input"
            placeholder="ipfs://ipfs/<CID>"
          />
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
            isError={
              isError && Boolean(debouncedTokenId && debouncedTokenAmount)
            }
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
            action: t("integration.action.mint"),
          })}
        </h3>
        <p className="text-center text-sm text-gray-500">
          {t("integration.mintAnyDescription", { standard: "NFT/SFT" })}
        </p>
      </CardFooter>
    </Card>
  )
}
