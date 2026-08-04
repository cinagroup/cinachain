"use client"

import { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Trash2,
} from "lucide-react"
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
import { useApiKeys } from "@/lib/hooks/use-api-keys"

export default function SettingsPage() {
  const { keys, isAuthenticated, signIn, createKey, revokeKey } = useApiKeys()
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await signIn()
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
      setError(
        err instanceof Error ? err.message : "Failed to create API key"
      )
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
      <div className="container max-w-[1200px] px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
            Account
          </span>
          <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            API Keys<span className="text-foreground">.</span>
          </h1>
          <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
            Create API keys bound to your wallet address for the billing gateway.
          </p>
        </div>

        {!isAuthenticated ? (
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Sign In
              </CardTitle>
              <CardDescription>
                Sign in with your wallet to manage API keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => void handleSignIn()}
                disabled={signingIn}
                className="w-full sm:w-auto"
              >
                {signingIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign In with Ethereum
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Error */}
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* Newly created key */}
            {newKey ? (
              <Alert className="border-emerald-500/50 [&>svg]:text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>API Key Created</AlertTitle>
                <AlertDescription>
                  <p>
                    Copy your key now — it won&apos;t be shown again.
                  </p>
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
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <Card className="shadow-vercel-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Keys are prefixed with <code className="rounded bg-secondary px-1">cina_</code>{" "}
                  and bound to your wallet address. The billing worker only stores the
                  SHA-256 hash of each key.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Create API Key
                </Button>

                {keys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">尚未创建</p>
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
                            Created {new Date(key.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          aria-label={`Revoke API key ${key.prefix}`}
                          onClick={() => revokeKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
