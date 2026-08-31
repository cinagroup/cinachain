import type { ReactNode } from "react"

import { createIntegrationMetadata } from "../_metadata"

export const metadata = createIntegrationMetadata("siwe")

export default function SiweIntegrationLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
