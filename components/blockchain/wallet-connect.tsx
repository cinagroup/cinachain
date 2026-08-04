import { HtmlHTMLAttributes } from "react"

// Reown AppKit connect button — supports EOA connectors (injected,
// WalletConnect, Coinbase) and email/social smart accounts in one modal.
import { AppKitConnectButton } from "@/components/blockchain/appkit-connect-button"

export const WalletConnect = ({
  className,
  ...props
}: HtmlHTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={className} {...props}>
      <AppKitConnectButton />
    </span>
  )
}
