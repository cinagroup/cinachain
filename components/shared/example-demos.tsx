"use client"

import type { ComponentPropsWithoutRef } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"
import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { PageSectionGrid } from "@/components/layout/page-section"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"

const demos = [
  {
    title: "Web3 Components for the power developer",
    description: "Pre-built Web3 components, powered by WAGMI",
    large: true,
    demo: (
      <div className="mx-auto justify-between">
        <IsWalletConnected>
          <div className="flex flex-col gap-5 lg:flex-row lg:gap-5 lg:pt-10">
            <div className="block text-center">
              <WalletAddress isLink truncate />
              <span className="mt-4 block font-mono text-xs font-semibold">
                &lt;WalletAddress isLink truncate /&gt;
              </span>
            </div>
          </div>
        </IsWalletConnected>
        <IsWalletDisconnected>
          <WalletConnect className="mx-auto inline-block" />
        </IsWalletDisconnected>
      </div>
    ),
  },
  {
    title: "Sign-In With Ethereum",
    description: "Authenticate using an Ethereum Account",
    href: "/integration/sign-in-with-ethereum",
    demo: (
      <div className="flex items-center justify-center space-x-20">
        <img
          alt="SIWE logo"
          height={80}
          src="/integrations/siwe.svg"
          width={80}
        />
      </div>
    ),
  },
  {
    title: "Reown AppKit",
    description:
      "One modal for EOA wallets (injected, WalletConnect, Coinbase) and email/social smart accounts.",
    demo: (
      <div className="flex items-center justify-center">
        <AppKitConnectButton />
      </div>
    ),
  },
  {
    title: "ERC-20",
    description: "ERC-20 is a standard for fungible tokens on EVM chains",
    href: "/integration/erc20",
    demo: (
      <div className="flex items-center justify-center space-x-20">
        <img
          alt="ERC-20 icon"
          height={100}
          src="/integrations/erc20.png"
          width={100}
        />
      </div>
    ),
  },
  {
    title: "ERC-721 NFT",
    description: "ERC-721 is a standard for non-fungible tokens on EVM chains",
    href: "/integration/erc721",
    demo: (
      <div className="flex items-center justify-center space-x-20">
        <img
          alt="ERC-721 icon"
          height={100}
          src="/integrations/erc721-icon.png"
          width={100}
        />
      </div>
    ),
  },
]

type ExampleDemosProps = ComponentPropsWithoutRef<"section">

export function ExampleDemos({ className, ...props }: ExampleDemosProps) {
  return (
    <PageSectionGrid className={className} {...props}>
      {demos.map(({ title, description, href, demo, large }) => (
        <DemoCard
          key={title}
          title={title}
          description={description}
          href={href}
          demo={demo}
          large={large}
        />
      ))}
    </PageSectionGrid>
  )
}

interface DemoCardProps {
  demo: React.ReactNode
  title: string
  description: string
  large?: boolean
  href?: string
}

function DemoCard({ title, description, href, demo, large }: DemoCardProps) {
  return (
    <div
      className={cn(
        "relative col-span-1 overflow-hidden rounded-xl border bg-card px-4 shadow-sm transition-shadow hover:shadow-md motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        large && "md:col-span-2"
      )}
    >
      <div className="flex h-60 items-center justify-center">{demo}</div>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display mb-3 bg-gradient-to-br from-black to-stone-500 bg-clip-text text-xl text-transparent dark:from-stone-100 dark:to-stone-400 md:text-3xl md:font-normal">
          {title}
        </h2>
        <p className="-mt-2 text-sm leading-normal text-muted-foreground">
          {description}
        </p>
        {!href ? null : (
          <Link href={href} className={cn(buttonVariants(), "my-4")}>
            Demo
          </Link>
        )}
      </div>
    </div>
  )
}
