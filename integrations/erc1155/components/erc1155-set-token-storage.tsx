import { FormEvent, useEffect, useMemo, useState } from "react"
import { Address, isAddress } from "viem"

import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import { useErc1155TokenStorage } from "../hooks/use-erc1155-token-storage"

export function Erc1155SetTokenStorage() {
  const { t } = useI18n()
  const [token, setToken] = useErc1155TokenStorage()
  const [tokenAddress, setTokenAddress] = useState<Address>()

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setToken(tokenAddress)
  }

  const isValidAddress = useMemo(
    () => tokenAddress && isAddress(tokenAddress),
    [tokenAddress]
  )

  useEffect(() => {
    setTokenAddress(token)
  }, [token])

  return (
    <Card>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label>{t("integration.field.selectedContractAddress")}</label>
          <input
            className="input"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value as Address)}
          />
          <Button disabled={!isValidAddress} type="submit">
            {t("integration.action.selectContractAddress")}
          </Button>
        </form>
      </CardContent>
      <Separator className="my-4" />
      <CardFooter className="justify-between">
        <h3 className="text-center">
          {t("integration.cardTitle", {
            standard: "ERC-1155",
            action: t("integration.action.selectContract"),
          })}
        </h3>
        <p className="text-center text-sm text-gray-500">
          {t("integration.selectContractDescription", {
            standard: "ERC-1155",
          })}
        </p>
      </CardFooter>
    </Card>
  )
}
