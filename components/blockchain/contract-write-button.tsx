"use client"

import { ButtonHTMLAttributes } from "react"

import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { Button } from "../ui/button"

interface ContractWriteButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoadingTx: boolean
  isLoadingWrite: boolean
  write?: boolean
  loadingWriteText?: string
  loadingTxText?: string
  text?: string
}

export const ContractWriteButton = ({
  children,
  className,
  isLoadingTx,
  isLoadingWrite,
  write = true,
  loadingWriteText,
  loadingTxText,
  ...props
}: ContractWriteButtonProps) => {
  const { t } = useI18n()

  return (
    <Button
      className={className}
      disabled={!write || isLoadingWrite || isLoadingTx}
      {...props}
    >
      {isLoadingWrite
        ? loadingWriteText ?? t("transaction.signInWallet")
        : isLoadingTx
        ? loadingTxText ?? t("transaction.writing")
        : children}
    </Button>
  )
}
