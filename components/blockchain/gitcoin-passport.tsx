"use client"

import { useGitcoinPassport } from "@/lib/hooks/use-gitcoin-passport"
import { useI18n } from "@/lib/i18n"
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
  const { t } = useI18n()
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
          <Shield className="size-5" />
          Gitcoin Passport
        </CardTitle>
        <CardDescription>
          {t("passport.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("passport.checking")}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {!isLoading && !error && score && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("passport.score")}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl">
                  {score.score !== null ? score.score.toFixed(1) : "N/A"}
                </span>
                {score.score !== null && (
                  <Badge
                    variant={isEligible ? "default" : "destructive"}
                    className={isEligible ? "bg-success" : ""}
                  >
                    {isEligible ? (
                      <>
                        <CheckCircle className="mr-1 size-3" />
                        {t("passport.eligible")}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mr-1 size-3" />
                        {t("passport.belowThreshold")}
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            {score.score === null && score.status === "DONE" && (
              <div className="text-sm text-muted-foreground">
                {t("passport.notSubmitted")}
              </div>
            )}

            {score.score !== null && !isEligible && (
              <div className="text-sm text-muted-foreground">
                {t("passport.lowScore", { threshold })}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={refreshScore}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                {t("passport.refresh")}
              </Button>
              {score.score === null && (
                <Button
                  onClick={submitPassport}
                  size="sm"
                  disabled={isLoading}
                >
                  {t("passport.submit")}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
