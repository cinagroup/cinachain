"use client"

import { motion } from "framer-motion"
import Link from "next/link"

import { FADE_DOWN_ANIMATION_VARIANTS } from "@/config/design"
import { WalletAddress } from "@/components/blockchain/wallet-address"
import { WalletBalance } from "@/components/blockchain/wallet-balance"
import { WalletEnsName } from "@/components/blockchain/wallet-ens-name"
import { IsWalletConnected } from "@/components/shared/is-wallet-connected"
import { IsWalletDisconnected } from "@/components/shared/is-wallet-disconnected"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAccount } from "wagmi"
import { useNftBalance } from "@/lib/hooks/use-nft-balance"

export default function PageDashboard() {
  const { address } = useAccount()
  const { data: nftBalance, isLoading: nftLoading } = useNftBalance(address)

  return (
    <motion.div
      animate="show"
      className="flex h-full w-full flex-col items-center justify-center lg:py-8"
      initial="hidden"
      variants={FADE_DOWN_ANIMATION_VARIANTS}
      viewport={{ once: true }}
      whileInView="show"
    >
      <IsWalletConnected>
        <div className="w-full max-w-4xl px-4">
          <div className="mb-8 text-center">
            <h3 className="text-2xl font-bold lg:text-4xl">
              <span className="bg-gradient-to-br from-indigo-600 to-purple-700 bg-clip-text text-transparent dark:from-indigo-100 dark:to-purple-200">
                Welcome, <WalletEnsName />
              </span>
            </h3>
            <span className="text-muted-foreground">
              <WalletAddress className="mt-2 block text-sm" />
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">ETH Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <WalletBalance decimals={4} /> ETH
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">NFTs Owned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {nftLoading ? "..." : nftBalance?.toString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">CinaChain NFTs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Whitelist Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Check mint page</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/mint">Mint NFT</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/explore">Explore Collection</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard/nfts">View My NFTs</Link>
            </Button>
          </div>
        </div>
      </IsWalletConnected>
      <IsWalletDisconnected>
        <h3 className="text-lg font-normal">
          Connect Wallet to view your personalized dashboard.
        </h3>
      </IsWalletDisconnected>
    </motion.div>
  )
}
