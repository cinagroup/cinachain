import { useReadContract } from "wagmi"
import { parseEther } from "viem"
import { CINA_NFT_CONTRACT, hasNftContract, MINT_PRICE_ETH } from "@/lib/contracts/addresses"
import { CINA_NFT_ABI } from "@/lib/contracts/abi"

/**
 * Read the current mint price from the contract.
 * Falls back to NEXT_PUBLIC_MINT_PRICE_ETH env value if the read
 * fails or the contract is not deployed.
 */
export function useMintPrice() {
  const query = useReadContract({
    address: CINA_NFT_CONTRACT,
    abi: CINA_NFT_ABI,
    functionName: "mintPrice",
    query: { enabled: hasNftContract },
  })

  const wei = query.data ?? null
  const eth = wei ? Number(wei) / 1e18 : MINT_PRICE_ETH
  const weiPerNft = wei ?? parseEther(String(MINT_PRICE_ETH))

  return {
    ...query,
    eth,
    wei,
    weiPerNft,
    fallbackEth: MINT_PRICE_ETH,
    isUsingFallback: !wei,
  }
}
