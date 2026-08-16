"use client"

import { ReactNode } from "react"

import { useSiwe } from "@/lib/hooks/use-siwe"

interface IsSignedOutProps {
  children: ReactNode
}

export const IsSignedOut = ({ children }: IsSignedOutProps) => {
  const { isAuthenticated } = useSiwe()

  if (!isAuthenticated) return <>{children}</>

  return null
}
