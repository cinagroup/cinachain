"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { KeyRound, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ||
  "https://cinachain-billing.cinagroup.workers.dev"

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
    loadRecords()
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
      setError("Connect your wallet first")
      return
    }
    if (apiKey.length < 20) {
      setError("API key too short")
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
      setSuccess(`Ingress registered: ${body.id} (${body.status})`)
      setApiKey("")
      await loadRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit key")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-[960px] px-6 py-12">
      <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
        Billing
      </span>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        Key Ingress<span className="text-muted-foreground">.</span>
      </h1>
      <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
        Share an API key with the platform pool and earn CinaCredit once it is
        consumed (spec §6.3 — declared amount, deferred minting).
      </p>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mt-6 border-[#50e3c2]/30 bg-[#50e3c2]/10">
          <CheckCircle2 className="h-4 w-4 text-[#29bc9b]" />
          <AlertDescription className="text-sm text-[#29bc9b]">{success}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Submit API Key
          </CardTitle>
          <CardDescription>
            Your key is encrypted at rest and never exposed; you earn credits
            when the pool consumes it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
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
              <Label htmlFor="model">Model</Label>
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
              <Label htmlFor="declared">Declared amount (micro-credit)</Label>
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
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Key
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-vercel-card">
        <CardHeader>
          <CardTitle>Your Ingress Records</CardTitle>
          <CardDescription>Pending / minting / minted status</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No records yet — submit a key above. Status updates after the pool
              consumes it (confirmedMicro grows toward declaredMicro).
            </p>
          ) : (
            <ul className="space-y-3">
              {records.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-mono-tech text-xs">{r.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.model} · confirmed {Number(r.confirmedMicro).toLocaleString()} / {Number(r.declaredMicro).toLocaleString()} micro
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
