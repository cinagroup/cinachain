"use client"

import { Erc1155Deploy } from "@/integrations/erc1155/components/erc1155-deploy"
import { Erc1155DeployTest } from "@/integrations/erc1155/components/erc1155-deploy-test"
import { Erc1155Read } from "@/integrations/erc1155/components/erc1155-read"
import { Erc1155SetTokenStorage } from "@/integrations/erc1155/components/erc1155-set-token-storage"
import { Erc1155WriteApprove } from "@/integrations/erc1155/components/erc1155-write-approve"
import { Erc1155WriteBatchTransfer } from "@/integrations/erc1155/components/erc1155-write-batch-transfer"
import { Erc1155WriteMint } from "@/integrations/erc1155/components/erc1155-write-mint"
import { Erc1155WriteTransfer } from "@/integrations/erc1155/components/erc1155-write-transfer"
import { useErc1155TokenStorage } from "@/integrations/erc1155/hooks/use-erc1155-token-storage"

export function Erc1155Workbench() {
  const [token] = useErc1155TokenStorage()

  return (
    <div className="flex w-full max-w-screen-lg flex-col gap-y-8">
      <Erc1155Deploy />
      <Erc1155DeployTest />
      <Erc1155SetTokenStorage />
      {token ? (
        <>
          <Erc1155Read address={token} />
          <Erc1155WriteMint address={token} />
          <Erc1155WriteApprove address={token} />
          <Erc1155WriteTransfer address={token} />
          <Erc1155WriteBatchTransfer address={token} />
        </>
      ) : null}
    </div>
  )
}
