"use client"

import { ERC721Deploy } from "@/integrations/erc721/components/erc721-deploy"
import { Erc721Read } from "@/integrations/erc721/components/erc721-read"
import { Erc721SetTokenStorage } from "@/integrations/erc721/components/erc721-set-token-storage"
import { Erc721WriteApprove } from "@/integrations/erc721/components/erc721-write-approve"
import { Erc721WriteMint } from "@/integrations/erc721/components/erc721-write-mint"
import { Erc721WriteTransfer } from "@/integrations/erc721/components/erc721-write-transfer"
import { useErc721TokenStorage } from "@/integrations/erc721/hooks/use-erc721-token-storage"

export function Erc721Workbench() {
  const [token] = useErc721TokenStorage()

  return (
    <div className="flex w-full max-w-screen-lg flex-col gap-y-8">
      <ERC721Deploy />
      <Erc721SetTokenStorage />
      {token ? (
        <>
          <Erc721Read address={token} />
          <Erc721WriteMint address={token} />
          <Erc721WriteApprove address={token} />
          <Erc721WriteTransfer address={token} />
        </>
      ) : null}
    </div>
  )
}
