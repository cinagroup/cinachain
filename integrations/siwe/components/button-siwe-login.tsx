"use client"

import { type HTMLAttributes } from "react"
import { useAccount } from "wagmi"

import { useSiwe } from "@/lib/hooks/use-siwe"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ButtonSIWELoginProps extends HTMLAttributes<HTMLButtonElement> {
  label?: string
  disabled?: boolean
}

/**
 * Client-side SIWE login button.
 * Signs an EIP-4361 message and stores the session in localStorage.
 *
 * NOTE: This is UX-only authentication. The authoritative access control
 * for privileged operations lives in the smart contract.
 */
export const ButtonSIWELogin = ({
  className,
  label = "Sign-In With Ethereum",
  disabled,
  children,
  ...props
}: ButtonSIWELoginProps) => {
  const { address } = useAccount()
  const { signIn, isLoading } = useSiwe()

  const classes = cn("relative", className)

  return (
    <Button
      variant="emerald"
      size="lg"
      className={classes}
      disabled={disabled || isLoading || !address}
      type="button"
      onClick={() => void signIn()}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
      {children || label}
    </Button>
  )
}
