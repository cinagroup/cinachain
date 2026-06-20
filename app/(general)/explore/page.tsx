import { getCinaNftContract } from "@/lib/contracts/cina-nft"
import CinaNftImage from "@/components/CinaNftImage"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export const metadata = {
  title: "Explore - CinaChain NFT Gallery",
  description: "Browse CinaChain NFT collection",
}

export default async function ExplorePage() {
  const contract = getCinaNftContract()

  let totalSupply = BigInt(0)
  let nfts: Array<{ tokenId: string; tokenURI: string }> = []

  try {
    totalSupply = (await contract.read.totalSupply()) as bigint

    // 获取前 20 个 NFT
    const count = Math.min(20, Number(totalSupply))
    nfts = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const tokenId = BigInt(i + 1)
        const tokenURI = (await contract.read.tokenURI([tokenId])) as string
        return { tokenId: tokenId.toString(), tokenURI }
      })
    )
  } catch (error) {
    console.error("Failed to fetch NFTs:", error)
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">CinaChain NFT Gallery</h1>

      {totalSupply === BigInt(0) && (
        <p className="text-muted-foreground">
          No NFTs minted yet. Check back soon!
        </p>
      )}

      {nfts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {nfts.map((nft) => (
            <Link key={nft.tokenId} href={`/collection/${nft.tokenId}`}>
              <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                <CinaNftImage
                  ipfsCidUrl={nft.tokenURI}
                  alt={`NFT #${nft.tokenId}`}
                />
              </div>
              <p className="mt-2 text-center font-medium">#{nft.tokenId}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
