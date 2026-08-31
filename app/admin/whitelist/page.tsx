"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle,
  Copy,
  FileText,
  KeyRound,
  Link2,
  Loader2,
  Upload,
} from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface WhitelistEntry {
  address: string
  mintLimit: number
}

const TOKEN_STORAGE_KEY = "cinachain-admin-token"

export default function WhitelistManagementPage() {
  const { t } = useI18n()
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle")
  const [deployStatus, setDeployStatus] = useState<
    "idle" | "success" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Actual count returned by the worker (dedupes addresses client-side too)
  const [activeCount, setActiveCount] = useState<number | null>(null)

  // Admin token is typed per-session by the operator. It is kept in
  // sessionStorage only — never in a NEXT_PUBLIC_* variable (which would
  // ship in the public bundle and defeat the auth).
  const [adminToken, setAdminToken] = useState("")

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY)
      if (stored) setAdminToken(stored)
    } catch {
      // sessionStorage unavailable — token must be typed each time
    }
  }, [])

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setUploadStatus("idle")
    setErrorMessage("")

    try {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())

      const parsedEntries: WhitelistEntry[] = []
      const seen = new Set<string>()

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Skip header row
        if (
          i === 0 &&
          (line.toLowerCase().includes("address") ||
            line.toLowerCase().includes("limit"))
        ) {
          continue
        }

        // The deployed contract enforces a fixed per-address cap of 3. A
        // lower CSV value would only be cosmetic and bypassable on-chain.
        const parts = line.split(",").map((p) => p.trim())
        const address = parts[0]

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error(
            t("admin.whitelistInvalidAddress", {
              line: i + 1,
              address,
            })
          )
        }

        if (parts[1] && Number(parts[1]) !== 3) {
          throw new Error(
            t("admin.whitelistInvalidLimit", { line: i + 1 })
          )
        }

        // Dedupe on lowercase address — first occurrence wins
        const key = address.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        parsedEntries.push({ address: key, mintLimit: 3 })
      }

      setEntries(parsedEntries)
      setUploadStatus("success")
    } catch (error) {
      setUploadStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : t("admin.whitelistParseFailed")
      )
      setEntries([])
    } finally {
      setIsProcessing(false)
      // Allow re-selecting the same file after upload/clear
      event.target.value = ""
    }
  }

  const handleDeployWhitelist = async () => {
    if (entries.length === 0) return
    if (!adminToken) {
      setDeployStatus("error")
      setErrorMessage(t("admin.whitelistAdminTokenRequired"))
      return
    }

    setIsDeploying(true)
    setDeployStatus("idle")
    setErrorMessage("")
    setMerkleRoot(null)
    setActiveCount(null)
    setCopied(false)

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_WHITELIST_API_URL ||
        "https://whitelist-api.cinachain.com"

      const response = await fetch(`${apiUrl}/admin/whitelist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({
          addresses: entries.map((e) => e.address),
          mintLimit: 3,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          data.error ||
            t("admin.whitelistDeployFailedStatus", { status: response.status })
        )
      }

      // Persist token for this browser session (not localStorage)
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, adminToken)
      } catch {
        // ignore
      }

      setDeployStatus("success")
      if (typeof data.count === "number") setActiveCount(data.count)
      if (data.merkleRoot) setMerkleRoot(data.merkleRoot)
    } catch (err) {
      setDeployStatus("error")
      setErrorMessage(
        err instanceof Error ? err.message : t("admin.whitelistDeployFailed")
      )
    } finally {
      setIsDeploying(false)
    }
  }

  const copyRoot = async () => {
    if (!merkleRoot) return
    try {
      await navigator.clipboard.writeText(merkleRoot)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-screen-ultra px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          {t("admin.title")}
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          {t("admin.whitelistManagement")}<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
          {t("admin.whitelistManagementDescription")}
        </p>

        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              {t("admin.whitelistUploadTitle")}
            </CardTitle>
            <CardDescription>
              {t("admin.whitelistUploadDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="mx-auto max-w-xs"
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {t("admin.whitelistCsvFormat")} {" "}
                <code className="rounded bg-muted px-2 py-1">address</code>
                <br />
                {t("admin.whitelistExample")} {" "}
                <code className="rounded bg-muted px-2 py-1">0x123...abc</code>
                <br />
                <span className="text-xs opacity-80">
                  {t("admin.whitelistLimitNote")}
                </span>
              </p>
            </div>

            {uploadStatus === "success" && (
              <Alert>
                <CheckCircle className="size-4" />
                <AlertDescription>
                  {t("admin.whitelistParsed", { count: entries.length })}
                </AlertDescription>
              </Alert>
            )}

            {uploadStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {entries.length > 0 && (
          <Card className="shadow-vercel-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                {t("admin.whitelistPreview", { count: entries.length })}
              </CardTitle>
              <CardDescription>
                {t("admin.whitelistPreviewDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Admin token input */}
              <div className="mb-4 space-y-2">
                <Label
                  htmlFor="admin-token"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <KeyRound className="size-4 text-muted-foreground" />
                  {t("admin.whitelistAdminToken")}
                </Label>
                <Input
                  id="admin-token"
                  type="password"
                  placeholder={t("admin.whitelistAdminTokenPlaceholder")}
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  className="max-w-md"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.whitelistAdminTokenNote")}
                </p>
              </div>

              {deployStatus === "success" && (
                <Alert variant="success" className="mb-4">
                  <CheckCircle className="size-4" />
                  <AlertDescription>
                    {t("admin.whitelistDeployed", {
                      count:
                        activeCount !== null ? activeCount : entries.length,
                    })}
                  </AlertDescription>
                </Alert>
              )}
              {deployStatus === "error" && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              {/* Merkle root — must be set on the contract by the owner */}
              {merkleRoot && (
                <Alert className="border-link/20 bg-link-bg-soft/40 mb-4">
                  <Link2 className="size-4 text-link-deep" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium text-link-deep">
                      {t("admin.whitelistRootGenerated")}
                    </span>{" "}
                    <span className="text-link-deep/80">
                      {t("admin.whitelistSetRootBefore")} {" "}
                      <a href="/admin/contract" className="underline">
                        {t("admin.whitelistContractRootLink")}
                      </a>{" "}
                      {t("admin.whitelistSetRootAfter")}
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="font-mono-tech flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                        {merkleRoot}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyRoot}
                        className="shrink-0"
                      >
                        <Copy className="mr-1 size-3" />
                        {copied
                          ? t("admin.whitelistCopied")
                          : t("admin.whitelistCopy")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-96 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">#</th>
                      <th className="p-2 text-left font-medium">
                        {t("admin.whitelistAddress")}
                      </th>
                      <th className="p-2 text-left font-medium">
                        {t("admin.whitelistMintLimit")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, 100).map((entry, index) => (
                      <tr key={entry.address} className="border-t">
                        <td className="p-2 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {entry.address}
                        </td>
                        <td className="p-2">{entry.mintLimit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entries.length > 100 && (
                  <div className="border-t p-4 text-center text-sm text-muted-foreground">
                    {t("admin.whitelistShowing", { count: entries.length })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  onClick={handleDeployWhitelist}
                  disabled={isDeploying || !adminToken}
                  className="flex-1"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t("admin.whitelistDeploying")}
                    </>
                  ) : (
                    t("admin.whitelistDeploy", { count: entries.length })
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEntries([])
                    setUploadStatus("idle")
                    setMerkleRoot(null)
                  }}
                >
                  {t("admin.whitelistClear")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.howItWorks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="mb-1 font-semibold">
                {t("admin.whitelistStep1Title")}
              </h3>
              <p className="text-muted-foreground">
                {t("admin.whitelistStep1Description")}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">
                {t("admin.whitelistStep2Title")}
              </h3>
              <p className="text-muted-foreground">
                {t("admin.whitelistStep2Description")}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">
                {t("admin.whitelistStep3Title")}
              </h3>
              <p className="text-muted-foreground">
                {t("admin.whitelistStep3Description")}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">
                {t("admin.whitelistStep4Title")}
              </h3>
              <p className="text-muted-foreground">
                {t("admin.whitelistStep4Description")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
