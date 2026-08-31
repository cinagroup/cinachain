"use client"

import { HTMLAttributes } from "react"
import { formatUnits, type Address } from "viem"
import { useAccount } from "wagmi"

import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

import {
  useReadErc20BalanceOf,
  useReadErc20Decimals,
  useReadErc20Name,
  useReadErc20Symbol,
  useReadErc20TotalSupply,
} from "../generated/erc20-wagmi"

interface ERC20Props extends HTMLAttributes<HTMLElement> {
  address: Address
}

interface ERC20ChainIdProps extends ERC20Props {
  chainId?: number
}

export function ERC20Image({ address, ...props }: ERC20Props) {
  return (
    <img
      alt={`Token ${address} icon`}
      className="mx-auto size-12 rounded-full border-2 border-white shadow-vercel-md"
      src={`https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/${address}/logo.png`}
      {...props}
    />
  )
}

export function ERC20Name({
  address,
  chainId,
  className,
  ...props
}: ERC20ChainIdProps) {
  const { data } = useReadErc20Name({
    address,
    chainId,
  })
  return (
    <span className={className} {...props}>
      {data}
    </span>
  )
}

export function ERC20Symbol({
  address,
  chainId,
  className,
  ...props
}: ERC20ChainIdProps) {
  const { data } = useReadErc20Symbol({
    address,
    chainId,
  })
  return (
    <span className={className} {...props}>
      {data}
    </span>
  )
}

export function ERC20TotalSupply({
  address,
  chainId,
  className,
  ...props
}: ERC20ChainIdProps) {
  const { data: decimals } = useReadErc20Decimals({
    address,
    chainId,
  })

  const { data } = useReadErc20TotalSupply({
    address,
    chainId,
  })
  return (
    <span className={className} {...props}>
      {Number(formatUnits(data || BigInt(0), decimals || 1)).toLocaleString()}
    </span>
  )
}

// @TODO: Add Decimals to Display
export function ERC20Decimals({
  address,
  chainId,
  className,
  ...props
}: ERC20ChainIdProps) {
  const { data } = useReadErc20Decimals({
    address,
    chainId,
  })
  return (
    <span className={className} {...props}>
      {data}
    </span>
  )
}

export function ERC20Balance({
  address,
  chainId,
  className,
  ...props
}: ERC20ChainIdProps) {
  const { address: accountAddress } = useAccount()
  const { data: decimals } = useReadErc20Decimals({
    address,
    chainId,
  })
  const { data } = useReadErc20BalanceOf({
    chainId,
    address,
    args: accountAddress ? [accountAddress] : undefined,
  })

  if (!data || !decimals) return null

  return (
    <span className={className} {...props}>
      {" "}
      {Number(formatUnits(data, decimals)).toLocaleString()}
    </span>
  )
}

interface ERC20ReadProps extends ERC20ChainIdProps {
  showImage?: boolean
  showBalance?: boolean
  showTotalSupply?: boolean
}

export function ERC20Read({
  className,
  address,
  chainId,
  showImage,
  showBalance,
  showTotalSupply,
  ...props
}: ERC20ReadProps) {
  const { t } = useI18n()

  return (
    <>
      <IsWalletConnected>
        <Card>
          <CardContent
            className={cn(
              "flex items-center justify-center gap-x-6",
              className
            )}
            {...props}
          >
            <div className="text-center">
              <span className="text-3xl">
                {showImage && (
                  <ERC20Image
                    address={address}
                    className="mx-auto size-12 rounded-full border-2 border-white shadow-vercel-md"
                  />
                )}
                <ERC20Name address={address} />
                <span className="ml-2">
                  (
                  <ERC20Symbol address={address} chainId={chainId} />)
                </span>
              </span>
              <div className="my-4 flex items-center justify-center gap-4">
                <span>
                  <span className="font-medium">
                    {t("integration.field.decimals")}
                  </span>{" "}
                  <ERC20Decimals address={address} chainId={chainId} />
                </span>
                {showTotalSupply && (
                  <>
                    <span>|</span>
                    <span>
                      <span className="font-medium">
                        {t("integration.field.totalSupply")}
                      </span>{" "}
                      <ERC20TotalSupply address={address} chainId={chainId} />
                    </span>
                  </>
                )}
                {showBalance && (
                  <>
                    <span>|</span>
                    <span>
                      <span className="font-medium">
                        {t("integration.field.balance")}
                      </span>
                      <ERC20Balance address={address} />
                    </span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
          <Separator className="my-4" />
          <CardFooter className="justify-between">
            <h3 className="text-center">
              {t("integration.cardTitle", {
                standard: "ERC-20",
                action: t("integration.action.read"),
              })}
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              {t("integration.readCoreDescription", { standard: "ERC-20" })}
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
