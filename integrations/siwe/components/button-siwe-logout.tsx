"use client"

import { type HTMLAttributes } from "react"

import { useSiwe } from "@/lib/hooks/use-siwe"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

interface ButtonSIWELogoutProps extends HTMLAttributes<HTMLButtonElement> {
  label?: string
}

export const ButtonSIWELogout = ({
  className,
  label,
  children,
  ...props
}: ButtonSIWELogoutProps) => {
  const { signOut } = useSiwe()
  const { t } = useI18n()

  return (
    <Button
      variant="blue"
      size="lg"
      className={className}
      onClick={() => signOut()}
      {...props}
    >
      {children || label || t("integration.signOut")}
    </Button>
  )
}
