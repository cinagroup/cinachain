import { AlertTriangle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ChainReadNoticeProps {
  state: "error" | "stale"
  title: string
  description: string
  isRetrying?: boolean
  onRetry: () => void
}

export function ChainReadNotice({
  state,
  title,
  description,
  isRetrying = false,
  onRetry,
}: ChainReadNoticeProps) {
  return (
    <Alert variant={state === "stale" ? "warning" : "destructive"}>
      <AlertTriangle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        <Button
          className="mt-3"
          disabled={isRetrying}
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw
            className={
              isRetrying ? "mr-2 size-3.5 animate-spin" : "mr-2 size-3.5"
            }
          />
          {isRetrying ? "Retrying..." : "Try again"}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
