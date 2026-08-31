"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { openAppKit } from "@/components/providers/appkit-provider"

interface AppKitConnectTriggerProps {
  className?: string
  label: string
  loadingLabel: string
}

export function AppKitConnectTrigger({
  className,
  label,
  loadingLabel,
}: AppKitConnectTriggerProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      await openAppKit("Connect")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="blue"
      className={className}
      disabled={loading}
      onClick={() => void handleConnect()}
    >
      {loading ? loadingLabel : label}
    </Button>
  )
}
