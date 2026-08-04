import { HTMLAttributes } from "react"
import { modal } from "@reown/appkit/react"
import { useAccount } from "wagmi"

import { Button } from "../ui/button"

interface WalletConnectCustomProps extends HTMLAttributes<HTMLDivElement> {
  classNameConnect?: string
  classNameConnected?: string
  classNameWrongNetwork?: string
  labelConnect?: string
  labelWrongNetwork?: string
}

export const WalletConnectCustom = ({
  className,
  labelConnect = "Connect Wallet",
  labelWrongNetwork = "Wrong Network",
  ...props
}: WalletConnectCustomProps) => {
  const { isConnected, chain } = useAccount()
  // wagmi only resolves `chain` for networks in the config (Base Sepolia),
  // so a connected wallet on any other network reports no chain -> wrong
  // network state (wagmi v3 dropped the RainbowKit-era `chain.unsupported`).
  const wrongNetwork = isConnected && !chain

  if (!isConnected) {
    return (
      <div className={className} {...props}>
        <Button
          variant="default"
          onClick={() => modal?.open({ view: "Connect" })}
        >
          {labelConnect}
        </Button>
      </div>
    )
  }

  if (wrongNetwork) {
    return (
      <div className={className} {...props}>
        <Button
          variant="destructive"
          onClick={() => modal?.open({ view: "Networks" })}
        >
          {labelWrongNetwork}
        </Button>
      </div>
    )
  }

  return (
    <div className={className} {...props}>
      <Button
        variant="default"
        onClick={() => modal?.open({ view: "Networks" })}
      >
        {chain?.name}
      </Button>
    </div>
  )
}

export default WalletConnectCustom
