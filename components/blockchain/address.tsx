import { HTMLAttributes } from "react"
import { type Address as AddressType } from "viem"

import { getBlockExplorerUrl } from "@/config/deployment"

import { LinkComponent } from "../shared/link-component"

interface AddressProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  address: AddressType
  truncate?: boolean
  isLink?: boolean
}

export const Address = ({
  address,
  className,
  truncate,
  isLink,
  ...props
}: AddressProps) => {
  const formattedAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  if (isLink) {
    return (
      <LinkComponent
        isExternal
        className={className}
        href={getBlockExplorerUrl("address", address)}
        {...props}
      >
        {formattedAddress}
      </LinkComponent>
    )
  }

  return (
    <span className={className} {...props}>
      {formattedAddress}
    </span>
  )
}
