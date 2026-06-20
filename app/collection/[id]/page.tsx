import { notFound } from "next/navigation"
import { getCinaNftContract } from "@/lib/contracts/cina-nft"
import { ipfsToHttps } from "@/lib/ipfs"
import CinaNftImage from "@/components/CinaNftImage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NftDetailPageProps {
  params: {
    id: string
  }
}

interface NftMetadata {
  name: string
  description: string
  image: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
}

async function getNftData(tokenId: string) {
  const contract = getCinaNftContract()
  
  try {
    const tokenURI = await contract.read.tokenURI([BigInt(tokenId)])
    const owner = await contract.read.ownerOf([BigInt(tokenId)])
    
    // Fetch metadata from IPFS
    const httpsUrl = ipfsToHttps(tokenURI)
    const res = await fetch(httpsUrl)
    
    if (!res.ok) {
      return { tokenURI, owner, metadata: null }
    }
    
    const metadata = await res.json()
    return { tokenURI, owner, metadata }
  } catch (error) {
    console.error("Failed to fetch NFT data:", error)
    return null
  }
}

export default async function NftDetailPage({ params }: NftDetailPageProps) {
  const { id } = params
  const nftData = await getNftData(id)
  
  if (!nftData) {
    notFound()
  }
  
  const { tokenURI, owner, metadata } = nftData
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Section */}
        <div className="space-y-4">
          <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
            <CinaNftImage 
              ipfsCidUrl={tokenURI} 
              alt={metadata?.name || `NFT #${id}`}
            />
          </div>
          
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1">
              <Link
                href={`https://etherscan.io/token/${process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT}?a=${id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Etherscan
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link
                href={`https://opensea.io/assets/ethereum/${process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT}/${id}`}
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
            <p className="text-sm text-muted-foreground">Token ID: {id}</p>
            <h1 className="text-4xl font-bold mt-1">
              {metadata?.name || `NFT #${id}`}
            </h1>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`https://etherscan.io/address/${owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {owner}
              </Link>
            </CardContent>
          </Card>
          
          {metadata?.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {metadata.description}
                </p>
              </CardContent>
            </Card>
          )}
          
          {metadata?.attributes && metadata.attributes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attributes</CardTitle>
                <CardDescription>
                  Traits and characteristics of this NFT
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {metadata.attributes.map((attr, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-muted/50 p-3"
                    >
                      <p className="text-xs text-muted-foreground uppercase">
                        {attr.trait_type}
                      </p>
                      <p className="font-semibold mt-1">
                        {attr.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract Address</span>
                  <Link
                    href={`https://etherscan.io/address/${process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono hover:text-foreground transition-colors"
                  >
                    {process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT?.slice(0, 6)}...{process.env.NEXT_PUBLIC_CINA_NFT_CONTRACT?.slice(-4)}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token Standard</span>
                  <span className="font-semibold">ERC-721</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Blockchain</span>
                  <span className="font-semibold">Ethereum</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
