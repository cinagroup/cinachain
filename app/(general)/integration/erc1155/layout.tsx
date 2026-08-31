import type { ReactNode } from "react"

import { createIntegrationMetadata } from "../_metadata"

export const metadata = createIntegrationMetadata("erc1155")

export default function Erc1155IntegrationLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
