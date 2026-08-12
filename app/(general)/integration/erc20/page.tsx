"use client"

import Link from "next/link"
import { cinaIntegrations } from "@/data/cina-integrations"
import { LuBook } from "react-icons/lu"

import {
  EXPLORER_NAME,
  getBlockExplorerUrl,
  PRIMARY_NETWORK_NAME,
} from "@/config/deployment"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import {
  PageHeader,
  PageHeaderCTA,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/layout/page-header"
import { PageSection } from "@/components/layout/page-section"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { LightDarkImage } from "@/components/shared/light-dark-image"
import { ERC20Deploy } from "@/integrations/erc20/components/erc20-deploy"
import { ERC20Read } from "@/integrations/erc20/components/erc20-read"
import { Erc20SetTokenStorage } from "@/integrations/erc20/components/erc20-set-token-storage"
import { ERC20WriteMint } from "@/integrations/erc20/components/erc20-write-mint"
import { ERC20WriteTransfer } from "@/integrations/erc20/components/erc20-write-transfer"
import { useERC20TokenStorage } from "@/integrations/erc20/hooks/use-erc20-token-storage"

export default function Erc20Page() {
  const [token] = useERC20TokenStorage()

  return (
    <div className="container relative mt-20">
      <PageHeader className="pb-8">
        <LightDarkImage
          LightImage={cinaIntegrations.erc20.imgDark}
          DarkImage={cinaIntegrations.erc20.imgLight}
          alt="ERC-20 Logo"
          width={100}
          height={100}
        />
        <PageHeaderHeading>ERC-20</PageHeaderHeading>
        <PageHeaderDescription>
          ERC-20 is a standard for fungible tokens on EVM chains
        </PageHeaderDescription>
        <PageHeaderCTA>
          <Link
            href={cinaIntegrations.erc20.url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <LuBook className="mr-2 size-4" />
            Documentation
          </Link>
        </PageHeaderCTA>
      </PageHeader>
      <PageSection>
        <IsWalletConnected>
          <div className="flex w-full max-w-screen-lg flex-col gap-y-8">
            <ERC20Deploy />
            <Erc20SetTokenStorage />
            {token && (
              <>
                <Card>
                  <CardContent className="flex flex-col">
                    <span className="mb-4 text-lg">
                      Inspect the selected ERC-20 token on {PRIMARY_NETWORK_NAME}
                      .
                    </span>
                    <Link
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" })
                      )}
                      href={getBlockExplorerUrl("token", token)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View token on {EXPLORER_NAME}
                    </Link>
                  </CardContent>
                </Card>
                <ERC20Read address={token} />
                <ERC20WriteMint address={token} />
                <ERC20WriteTransfer address={token} />
              </>
            )}
          </div>
        </IsWalletConnected>
        <IsWalletDisconnected>
          <div className="flex items-center justify-center">
            <WalletConnect />
          </div>
        </IsWalletDisconnected>
      </PageSection>
    </div>
  )
}
