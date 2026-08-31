"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { KeyRound, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://billing-api.cinachain.com"

const MODELS = [
  { id: "demo", label: "Demo" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "deepseek-v3", label: "DeepSeek V3" },
  { id: "hunyuan", label: "Hunyuan" },
]

interface IngressRecord {
  id: string
  owner: string
  model: string
  declaredMicro: string
  confirmedMicro: string
  status: string
  createdAt: number
}

export default function KeysPage() {
  const { t } = useI18n()
  const { address } = useAccount()
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("demo")
  const [declared, setDeclared] = useState("1000000")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [records, setRecords] = useState<IngressRecord[]>([])

  // Reset transient state on account switch
  useEffect(() => {
    setError(null)
    setSuccess(null)
    setApiKey("")
    void loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const loadRecords = async () => {
    if (!address) return
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/ingress?owner=${address}`)
      if (!res.ok) return
      const body = await res.json()
      setRecords(body.records ?? [])
    } catch {
      /* ignore */
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!address) {
      setError(t("keys.connectWalletFirst"))
      return
    }
    if (apiKey.length < 20) {
      setError(t("keys.tooShort"))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${BILLING_API_URL}/v1/ingress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, declaredMicro: declared, owner: address }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `submit failed: ${res.status}`)
      setSuccess(
        t("keys.registered", {
          id: String(body.id),
          status: String(body.status),
        })
      )
      setApiKey("")
      await loadRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("keys.submitFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-screen-desktop px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        {t("sidebar.billing")}
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        {t("keys.title")}<span className="text-muted-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        {t("keys.ingressDescription")}
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            {t("keys.submitTitle")}
          </CardTitle>
          <CardDescription>
            {t("keys.submitDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">{t("settings.apiKeys")}</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">{t("keys.model")}</Label>
              <select
                id="model"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-vercel-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={submitting}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="declared">{t("keys.declaredAmount")}</Label>
              <Input
                id="declared"
                type="number"
                min="1"
                value={declared}
                onChange={(e) => setDeclared(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !address} className="w-full" size="lg">
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            {t("keys.submitAction")}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>{t("keys.recordsTitle")}</CardTitle>
          <CardDescription>{t("keys.recordsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("keys.noRecords")}
            </p>
          ) : (
            <ul className="space-y-3">
              {records.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-mono-tech text-xs">{r.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("keys.recordProgress", {
                        model: r.model,
                        confirmed: Number(r.confirmedMicro).toLocaleString(),
                        declared: Number(r.declaredMicro).toLocaleString(),
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-medium">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
