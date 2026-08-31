import { useForm } from "react-hook-form"
import { useDebounceValue } from "usehooks-ts"
import { parseEther, type Address, type BaseError } from "viem"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"

import { useI18n } from "@/lib/i18n"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"
import { ContractWriteButton } from "@/components/blockchain/contract-write-button"
import { TransactionStatus } from "@/components/blockchain/transaction-status"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

import {
  useSimulateErc20MintableMint,
  useWriteErc20MintableMint,
} from "../generated/erc20-wagmi"
import ERC20EventMint from "./erc20-event-mint"

interface ERC20WriteMintProps {
  address: Address
}

function ERC20ContractMintTokens({ address }: ERC20WriteMintProps) {
  const { t } = useI18n()
  const { register, watch, handleSubmit } = useForm()
  const watchAmount: string = watch("amount")
  const [debouncedAmount] = useDebounceValue(watchAmount, 500)

  const { address: accountAddress } = useAccount()

  const isValidAmount = Boolean(
    debouncedAmount && !isNaN(Number(debouncedAmount))
  )

  const {
    data: config,
    error,
    isError,
  } = useSimulateErc20MintableMint({
    address,
    args:
      accountAddress && isValidAmount
        ? [accountAddress, parseEther(`${Number(debouncedAmount)}`)]
        : undefined,
    query: {
      enabled: Boolean(accountAddress && isValidAmount),
    },
  })

  const {
    data,
    writeContract,
    isPending: isLoadingWrite,
  } = useWriteErc20MintableMint()

  const { isLoading: isLoadingTx, isSuccess } = useWaitForTransactionReceipt({
    hash: data,
  })

  const onSubmit = () => {
    writeContract?.(config!.request)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <label>{t("integration.field.amount")}</label>
      <input className="input" placeholder="1000" {...register("amount")} />
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
  )
}

export function ERC20WriteMint({ address }: ERC20WriteMintProps) {
  const { t } = useI18n()

  return (
    <>
      <IsWalletConnected>
        <Card>
          <CardContent>
            <ERC20ContractMintTokens address={address} />
            <ERC20EventMint />
          </CardContent>
          <Separator className="my-4" />
          <CardFooter className="justify-between">
            <h3 className="text-center">
              {t("integration.cardTitle", {
                standard: "ERC-20",
                action: t("integration.action.mint"),
              })}
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              {t("integration.mintSelfDescription")}
            </p>
          </CardFooter>
        </Card>
      </IsWalletConnected>
      <IsWalletDisconnected>
        <div className="flex items-center justify-center gap-10">
          <AppKitConnectButton />
        </div>
      </IsWalletDisconnected>
    </>
  )
}
