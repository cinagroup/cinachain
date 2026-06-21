"use client"

import { useGitcoinPassport } from "@/lib/hooks/use-gitcoin-passport"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAccount } from "wagmi"
import { Shield, AlertCircle, CheckCircle, Loader2 } from "lucide-react"

interface GitcoinPassportProps {
  scorerId?: string
  apiKey?: string
  threshold?: number
  onEligibilityChange?: (eligible: boolean) => void
}

export function GitcoinPassport({
  scorerId,
  apiKey,
  threshold = 20,
  onEligibilityChange,
}: GitcoinPassportProps) {
  const { isConnected } = useAccount()
  const { score, isEligible, isLoading, error, refreshScore, submitPassport } =
    useGitcoinPassport({
      scorerId,
      apiKey,
      threshold,
      autoSubmit: false,
    })

  if (!isConnected) {
    return null
  }

  return (
    <Card className="shadow-vercel-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Gitcoin Passport
        </CardTitle>
        <CardDescription>
          Verify your identity to prevent sybil attacks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking passport score...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!isLoading && !error && score && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Score</span>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl">
                  {score.score !== null ? score.score.toFixed(1) : "N/A"}
                </span>
                {score.score !== null && (
                  <Badge
                    variant={isEligible ? "default" : "destructive"}
                    className={isEligible ? "bg-emerald-600" : ""}
                  >
                    {isEligible ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Eligible
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Below Threshold
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            {score.score === null && score.status === "DONE" && (
              <div className="text-sm text-muted-foreground">
                No passport submitted. Click below to submit your passport.
              </div>
            )}

            {score.score !== null && !isEligible && (
              <div className="text-sm text-muted-foreground">
                Your score is below the threshold of {threshold}. Add more stamps to increase your score.
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={refreshScore}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                Refresh
              </Button>
              {score.score === null && (
                <Button
                  onClick={submitPassport}
                  size="sm"
                  disabled={isLoading}
                >
                  Submit Passport
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
