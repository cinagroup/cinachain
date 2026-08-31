import { FormEvent, useEffect, useMemo, useState } from "react"
import { isAddress, type Address } from "viem"

import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import { useErc721TokenStorage } from "../hooks/use-erc721-token-storage"

export function Erc721SetTokenStorage() {
  const { t } = useI18n()
  const [token, setToken] = useErc721TokenStorage()
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
          <Button variant="default" disabled={!isValidAddress} type="submit">
            {t("integration.action.selectContractAddress")}
          </Button>
        </form>
      </CardContent>
      <Separator className="my-4" />
      <CardFooter className="justify-between">
        <h3 className="text-center">
          {t("integration.cardTitle", {
            standard: "ERC-721",
            action: t("integration.action.selectContract"),
          })}
        </h3>
        <p className="text-center text-sm text-muted-foreground">
          {t("integration.selectContractDescription", { standard: "ERC-721" })}
        </p>
      </CardFooter>
    </Card>
  )
}
