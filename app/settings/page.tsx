"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Trash2,
} from "lucide-react"
import { useAccount } from "wagmi"

import { useApiKeys } from "@/lib/hooks/use-api-keys"
import { useI18n } from "@/lib/i18n"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SettingsPage() {
  const { locale, t } = useI18n()
  const { keys, isAuthenticated, signIn, signInError, createKey, revokeKey } =
    useApiKeys()
  const { address } = useAccount()
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [copied, setCopied] = useState(false)

  // Clear transient state when the connected account changes so a key
  // created under one address never leaks into another address's view.
  useEffect(() => {
    setNewKey(null)
    setError(null)
    setCopied(false)
  }, [address])

  // Surface hook-level sign-in errors (e.g. signature verification
  // failure) as soon as they occur: handleSignIn's closure captures the
  // pre-attempt value of signInError, so only this effect can show the
  // accurate reason on the first failed attempt.
  useEffect(() => {
    if (signInError) setError(signInError)
  }, [signInError])

  const handleSignIn = async () => {
    setSigningIn(true)
    setError(null)
    try {
      const ok = await signIn()
      if (!ok)
        setError(signInError ?? t("settings.signInFailed"))
    } catch {
      setError(t("settings.signInFailed"))
    } finally {
      setSigningIn(false)
    }
  }

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    try {
      const raw = await createKey()
      setNewKey(raw)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.createFailed"))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore clipboard errors */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            {t("settings.account")}
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            {t("settings.apiKeys")}
            <span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            {t("settings.description")}
          </p>
        </div>

        {!isAuthenticated ? (
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                {t("settings.signIn")}
              </CardTitle>
              <CardDescription>
                {t("settings.signInDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => void handleSignIn()}
                disabled={signingIn}
                className="w-full sm:w-auto"
              >
                {signingIn ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t("settings.signInWithEthereum")}
              </Button>
              {!address ? (
                <p className="text-sm text-muted-foreground">
                  {t("settings.connectFirst")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Error */}
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t("settings.error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* Newly created key */}
            {newKey ? (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>{t("settings.created")}</AlertTitle>
                <AlertDescription>
                  <p>{t("settings.copyNow")}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      readOnly
                      value={newKey}
                      className="font-mono-tech text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCopy()}
                      className="shrink-0"
                    >
                      {copied ? (
                        <CheckCircle2 className="mr-2 size-4 text-success" />
                      ) : (
                        <Copy className="mr-2 size-4" />
                      )}
                      {copied ? t("settings.copied") : t("settings.copy")}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-5" />
                  {t("settings.apiKeys")}
                </CardTitle>
                <CardDescription>
                  {t("settings.keysPrefixBefore")} {" "}
                  <code className="rounded bg-secondary px-1">cina_</code>{" "}
                  {t("settings.keysPrefixAfter")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => void handleCreate()} disabled={creating}>
                  {creating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 size-4" />
                  )}
                  {t("settings.create")}
                </Button>

                {keys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("settings.empty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {keys.map((key) => (
                      <li
                        key={key.id}
                        className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-mono-tech text-sm text-foreground">
                            {key.prefix}
                            <span className="tracking-tight">••••••••</span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("settings.createdAt", {
                              date: new Date(key.createdAt).toLocaleString(locale),
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive hover:text-destructive"
                          aria-label={t("settings.revokeAria", {
                            prefix: key.prefix,
                          })}
                          onClick={() => {
                            void revokeKey(key.id).catch((cause: unknown) => {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : t("settings.revokeFailed")
                              )
                            })
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
