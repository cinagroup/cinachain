import { useState } from "react"
import { FieldValues, useForm } from "react-hook-form"
import { usePublicClient, useWalletClient } from "wagmi"

import { useI18n } from "@/lib/i18n"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BlockExplorerLink } from "@/components/blockchain/block-explorer-link"
import { ContractWriteButton } from "@/components/blockchain/contract-write-button"

import { erc20MintableABI } from "../abis/erc20-mintable-abi"
import { erc20MintableByteCode } from "../abis/erc20-mintable-bytecode"
import { useERC20TokenStorage } from "../hooks/use-erc20-token-storage"

export function DeployERC20Contract() {
  const { t } = useI18n()
  const [token, setToken] = useERC20TokenStorage()
  const [isSigning, setIsSigning] = useState<boolean>(false)
  const [isWaitingTransaction, setIsWaitingTransaction] =
    useState<boolean>(false)

  const { register, handleSubmit, watch } = useForm()
  const name = watch("name")
  const symbol = watch("symbol")

  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const onSubmit = async (data: FieldValues) => {
    if (!walletClient) return
    setIsSigning(true)

    let hash: `0x${string}` | undefined

    try {
      hash = await walletClient.deployContract({
        abi: erc20MintableABI,
        bytecode: erc20MintableByteCode,
        args: [data.name, data.symbol],
      })
    } catch (e) {
      setIsSigning(false)
      return
    }

    setIsSigning(false)
    setIsWaitingTransaction(true)
    try {
      if (!publicClient || !hash) return
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (!receipt.contractAddress) return

      setIsWaitingTransaction(false)
      setToken(receipt.contractAddress)
    } catch (e) {
      setIsWaitingTransaction(false)
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <label>{t("integration.field.name")}</label>
      <input {...register("name")} className="input" />
      <label>{t("integration.field.symbol")}</label>
      <input {...register("symbol")} className="input" />
      <ContractWriteButton
        isLoadingTx={isWaitingTransaction}
        isLoadingWrite={isSigning}
        loadingTxText={t("integration.action.deploying")}
        write={Boolean(name && symbol)}
      >
        {t("integration.action.deploy")}
      </ContractWriteButton>
      {!token ? null : (
        <div className="flex max-w-full flex-wrap items-center justify-between break-words pb-2 pt-5">
          <span className="font-semibold">
            {t("integration.mintContractAddress")}:
          </span>
          <BlockExplorerLink address={token} />
        </div>
      )}
    </form>
  )
}

export function ERC20Deploy() {
  const { t } = useI18n()

  return (
    <Card>
      <CardContent>
        <DeployERC20Contract />
      </CardContent>
      <Separator className="my-4" />
      <CardFooter className="justify-between">
        <h3 className="text-center">
          {t("integration.cardTitle", {
            standard: "ERC-20",
            action: t("integration.action.deploy"),
          })}
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          {t("integration.deployNewDescription", { standard: "ERC-20" })}
        </p>
      </CardFooter>
    </Card>
  )
}
