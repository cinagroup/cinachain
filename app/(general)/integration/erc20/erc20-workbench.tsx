"use client"

import Link from "next/link"

import {
  EXPLORER_NAME,
  getBlockExplorerUrl,
  PRIMARY_NETWORK_NAME,
} from "@/config/deployment"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ERC20Deploy } from "@/integrations/erc20/components/erc20-deploy"
import { ERC20Read } from "@/integrations/erc20/components/erc20-read"
import { Erc20SetTokenStorage } from "@/integrations/erc20/components/erc20-set-token-storage"
import { ERC20WriteMint } from "@/integrations/erc20/components/erc20-write-mint"
import { ERC20WriteTransfer } from "@/integrations/erc20/components/erc20-write-transfer"
import { useERC20TokenStorage } from "@/integrations/erc20/hooks/use-erc20-token-storage"

export function Erc20Workbench() {
  const { t } = useI18n()
  const [token] = useERC20TokenStorage()

  return (
    <div className="flex w-full max-w-screen-lg flex-col gap-y-8">
      <ERC20Deploy />
      <Erc20SetTokenStorage />
      {token ? (
        <>
          <Card>
            <CardContent className="flex flex-col">
              <span className="mb-4 text-lg">
                {t("integration.inspectSelectedToken", {
                  network: PRIMARY_NETWORK_NAME,
                })}
              </span>
              <Link
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" })
                )}
                href={getBlockExplorerUrl("token", token)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("integration.viewOnExplorer", {
                  explorer: EXPLORER_NAME,
                })}
              </Link>
            </CardContent>
          </Card>
          <ERC20Read address={token} />
          <ERC20WriteMint address={token} />
          <ERC20WriteTransfer address={token} />
        </>
      ) : null}
    </div>
  )
}
