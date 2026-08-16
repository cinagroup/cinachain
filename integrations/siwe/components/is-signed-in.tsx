"use client"

import { ReactNode } from "react"

import { useSiwe } from "@/lib/hooks/use-siwe"

interface IsSignedInProps {
  children: ReactNode
}

export const IsSignedIn = ({ children }: IsSignedInProps) => {
  const { isAuthenticated } = useSiwe()

  if (isAuthenticated) return <>{children}</>

  return null
}
