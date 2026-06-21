"use client"

import { useState, useEffect } from "react"
import { useReadContract } from "wagmi"
import { parseAbiItem } from "viem"
import CinaNftImage from "@/components/CinaNftImage"
import Link from "next/link"

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`

const ABI = [
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
] as const

export default function ExplorePage() {
  const [nfts, setNfts] = useState<Array<{ tokenId: string; tokenURI: string }>>([])
  const [loading, setLoading] = useState(true)

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "totalSupply",
  })

  useEffect(() => {
    if (totalSupply === undefined) return
    const count = Math.min(20, Number(totalSupply))
    if (count === 0) { setLoading(false); return }

    const fetchNFTs = async () => {
      try {
        const nftList = await Promise.all(
          Array.from({ length: count }, async (_, i) => {
            const tokenId = BigInt(i + 1)
            return {
              tokenId: tokenId.toString(),
              tokenURI: `ipfs://placeholder-${tokenId}`,
            }
          })
        )
        setNfts(nftList)
      } catch (error) {
        console.error("Failed to fetch NFTs:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchNFTs()
  }, [totalSupply])

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Eyebrow */}
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Collection
        </span>

        {/* Heading */}
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          CinaChain NFT Gallery<span className="text-foreground">.</span>
        </h1>

        <p className="mt-3 max-w-[560px] text-base leading-7 text-foreground/60">
          Browse the full collection. Each NFT is stored on IPFS with multi-gateway fallback.
        </p>

        {/* Stats Bar */}
        {totalSupply !== undefined && (
          <div className="mt-8 flex items-center gap-6">
            <div className="rounded-md border border-border bg-card px-4 py-2 shadow-vercel-sm">
              <span className="text-xs text-muted-foreground">Total Supply</span>
              <p className="font-display text-lg text-foreground">{totalSupply.toString()}</p>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading && (
          <p className="mt-12 text-sm text-muted-foreground">Loading...</p>
        )}

        {totalSupply === 0n && !loading && (
          <div className="mt-12 rounded-lg border border-border bg-card p-12 text-center shadow-vercel-card">
            <p className="text-base text-foreground/60">No NFTs minted yet. Check back soon!</p>
          </div>
        )}

        {nfts.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nfts.map((nft) => (
              <NftCard key={nft.tokenId} tokenId={nft.tokenId} tokenURI={nft.tokenURI} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NftCard({ tokenId, tokenURI }: { tokenId: string; tokenURI: string }) {
  return (
    <Link href={`/collection/${tokenId}`}>
      <div className="group overflow-hidden rounded-lg border border-border bg-card shadow-vercel-card transition-all hover:shadow-vercel-md hover:-translate-y-0.5">
        <div className="aspect-square relative bg-secondary">
          {!tokenURI.includes("placeholder") ? (
            <CinaNftImage ipfsCidUrl={tokenURI} alt={`NFT #${tokenId}`} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-4xl text-muted-foreground/30">#{tokenId}</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">#{tokenId}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              ERC-721
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
