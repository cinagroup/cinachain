"use client"

import { useState, useEffect } from "react"
import { useReadContract } from "wagmi"
import { parseAbiItem } from "viem"
import Link from "next/link"
import CinaNftImage from "@/components/CinaNftImage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`

const ABI = [
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem("function ownerOf(uint256 tokenId) view returns (address)"),
  parseAbiItem("function name() view returns (string)"),
] as const

export default function NftDetailClient({ tokenId }: { tokenId: string }) {
  const [metadata, setMetadata] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  })

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })

  const { data: collectionName } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "name",
  })

  useEffect(() => {
    if (!tokenURI) return

    const fetchMetadata = async () => {
      try {
        let url = tokenURI
        if (tokenURI.startsWith("ipfs://")) {
          url = tokenURI.replace(
            "ipfs://",
            process.env.NEXT_PUBLIC_CF_IPFS_GATEWAY + "/ipfs/"
          )
        }
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setMetadata(data)
        }
      } catch (error) {
        console.error("Failed to fetch metadata:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetadata()
  }, [tokenURI])

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">
                Collection
              </Link>
            </li>
            <li className="text-muted-foreground">/</li>
            <li className="text-foreground font-medium">#{tokenId}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-card shadow-vercel-card">
              {tokenURI && !tokenURI.includes("placeholder") ? (
                <CinaNftImage ipfsCidUrl={tokenURI} alt={`NFT #${tokenId}`} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-display text-6xl text-muted-foreground/30">
                    #{tokenId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <Link
                  href={`https://etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Etherscan
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link
                  href={`https://opensea.io/assets/ethereum/${CONTRACT_ADDRESS}/${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on OpenSea
                </Link>
              </Button>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            <div>
              <p className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
                Token ID
              </p>
              <h1 className="font-display mt-2 text-3xl tracking-tight text-foreground">
                {loading ? "Loading..." : metadata?.name || `NFT #${tokenId}`}
              </h1>
            </div>

            {owner && (
              <Card className="shadow-vercel-card">
                <CardHeader>
                  <CardTitle className="text-base">Owner</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`https://etherscan.io/address/${owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-tech text-sm text-link hover:text-link-deep transition-colors break-all"
                  >
                    {owner}
                  </Link>
                </CardContent>
              </Card>
            )}

            {metadata?.description && (
              <Card className="shadow-vercel-card">
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-foreground/70">
                    {metadata.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {metadata?.attributes && metadata.attributes.length > 0 && (
              <Card className="shadow-vercel-card">
                <CardHeader>
                  <CardTitle className="text-base">Attributes</CardTitle>
                  <CardDescription>
                    {metadata.attributes.length} traits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {metadata.attributes.map((attr: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-md border border-border bg-secondary p-3"
                      >
                        <p className="font-mono-tech text-[10px] uppercase tracking-wider text-muted-foreground">
                          {attr.trait_type}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {attr.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="text-base">Contract Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Collection</dt>
                    <dd className="font-medium text-foreground">
                      {collectionName || "CinaChain NFT"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Contract Address</dt>
                    <dd>
                      <Link
                        href={`https://etherscan.io/address/${CONTRACT_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-tech text-link hover:text-link-deep transition-colors"
                      >
                        {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
                      </Link>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Token Standard</dt>
                    <dd className="font-medium text-foreground">ERC-721</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Blockchain</dt>
                    <dd className="font-medium text-foreground">Ethereum</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
