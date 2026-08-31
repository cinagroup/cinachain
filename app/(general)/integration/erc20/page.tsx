"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { cinaIntegrations } from "@/data/cina-integrations"
import { LuBook } from "react-icons/lu"

import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { IntegrationWorkbenchLoading } from "@/components/blockchain/integration-workbench-loading"
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

const Erc20Workbench = dynamic(
  () => import("./erc20-workbench").then((module) => module.Erc20Workbench),
  {
    ssr: false,
    loading: () => <IntegrationWorkbenchLoading />,
  }
)

export default function Erc20Page() {
  const { t } = useI18n()

  return (
    <div className="container relative mt-20">
      <PageHeader className="pb-8">
        <LightDarkImage
          LightImage={cinaIntegrations.erc20.imgDark}
          DarkImage={cinaIntegrations.erc20.imgLight}
          alt={t("integration.logoAlt", { standard: "ERC-20" })}
          width={100}
          height={100}
        />
        <PageHeaderHeading>ERC-20</PageHeaderHeading>
        <PageHeaderDescription>
          {t("integration.erc20Description")}
        </PageHeaderDescription>
        <PageHeaderCTA>
          <Link
            href={cinaIntegrations.erc20.url}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <LuBook className="mr-2 size-4" />
            {t("integration.documentation")}
          </Link>
        </PageHeaderCTA>
      </PageHeader>
      <PageSection>
        <IsWalletConnected>
          <Erc20Workbench />
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
