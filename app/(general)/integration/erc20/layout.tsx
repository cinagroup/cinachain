import type { ReactNode } from "react"

import { createIntegrationMetadata } from "../_metadata"

export const metadata = createIntegrationMetadata("erc20")

export default function Erc20IntegrationLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
