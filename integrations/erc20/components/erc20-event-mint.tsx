import { useState } from "react"
import { formatEther, zeroAddress, type Address } from "viem"

import { useI18n } from "@/lib/i18n"
import { useWatchErc20TransferEvent } from "../generated/erc20-wagmi"
import { useERC20TokenStorage } from "../hooks/use-erc20-token-storage"

export default function ERC20EventMint() {
  const { t } = useI18n()
  const [token] = useERC20TokenStorage()
  const [event, setEvent] = useState<{
    from: Address
    to: Address
    amount: bigint
  }>()

  useWatchErc20TransferEvent({
    address: token,
    onLogs(logs) {
      const { args } = logs[0]
      const { _from, _to, _value } = args
      if (_from == zeroAddress && _to && _value) {
        setEvent({
          from: _from,
          to: _to,
          amount: _value,
        })
      }
    },
  })

  if (!token || !event) return null

  return (
    <div className="px-10 py-6">
      {!event?.to ? null : (
        <>
          <p>{t("integration.field.from")}: {event?.from}</p>
          <p>{t("integration.field.to")}: {event?.to}</p>
          <p>{t("integration.field.amount")}: {event?.amount ? formatEther(event?.amount) : "0"}</p>
        </>
      )}
    </div>
  )
}
