import type { ReactNode } from "react"

import { createIntegrationMetadata } from "../_metadata"

export const metadata = createIntegrationMetadata("erc721")

export default function Erc721IntegrationLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
