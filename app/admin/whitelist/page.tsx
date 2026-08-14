"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Copy, KeyRound, Link2 } from "lucide-react"

interface WhitelistEntry {
  address: string
  mintLimit: number
}

const TOKEN_STORAGE_KEY = "cinachain-admin-token"

export default function WhitelistManagementPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle")
  const [deployStatus, setDeployStatus] = useState<"idle" | "success" | "error">("idle")
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        if (i === 0 && (line.toLowerCase().includes("address") || line.toLowerCase().includes("limit"))) {
          continue
        }

        // Parse CSV: address,limit or just address (default limit = 1)
        const parts = line.split(",").map((p) => p.trim())
        const address = parts[0]
        const limit = parts[1] ? parseInt(parts[1]) : 1

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new Error(`Invalid address format at line ${i + 1}: ${address}`)
        }

        if (isNaN(limit) || limit < 1 || limit > 3) {
          throw new Error(`Invalid mint limit at line ${i + 1}: ${parts[1]} (must be 1-3, the contract&apos;s whitelist cap)`)
        }

        // Dedupe on lowercase address — first occurrence wins
        const key = address.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        parsedEntries.push({ address: key, mintLimit: limit })
      }

      setEntries(parsedEntries)
      setUploadStatus("success")
    } catch (error) {
      setUploadStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Failed to parse CSV file")
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
      setErrorMessage("Enter the admin token to deploy the whitelist")
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

      // Per-address mint limits (the worker stores them individually)
      const limits: Record<string, number> = {}
      for (const e of entries) limits[e.address] = e.mintLimit

      const response = await fetch(`${apiUrl}/admin/whitelist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({
          addresses: entries.map((e) => e.address),
          limits,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || `Deploy failed: ${response.status}`)
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
        err instanceof Error ? err.message : "Failed to deploy whitelist"
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
      <div className="container max-w-[1400px] px-6 py-12">
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted-foreground">
          Administration
        </span>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
          Whitelist management<span className="text-foreground">.</span>
        </h1>
        <p className="mt-3 max-w-[560px] text-base text-muted-foreground">
          Upload and manage whitelist addresses for the minting process.
        </p>

        <Card className="mt-8 shadow-vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5" />
              Upload whitelist CSV
            </CardTitle>
            <CardDescription>
              Upload a CSV file with addresses and mint limits
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
                CSV format: <code className="rounded bg-muted px-2 py-1">address,limit</code>
                <br />
                Example: <code className="rounded bg-muted px-2 py-1">0x123...abc,3</code>
                <br />
                    <span className="text-xs opacity-80">Limit must be 1-3 (the contract&apos;s whitelist cap). Duplicate addresses are ignored.</span>
              </p>
            </div>

            {uploadStatus === "success" && (
              <Alert>
                <CheckCircle className="size-4" />
                <AlertDescription>
                  Successfully parsed {entries.length} addresses from CSV file
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
                Preview ({entries.length} addresses)
              </CardTitle>
              <CardDescription>
                Review the addresses before deploying to the whitelist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Admin token input */}
              <div className="mb-4 space-y-2">
                <Label htmlFor="admin-token" className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="size-4 text-muted-foreground" />
                  Admin token
                </Label>
                <Input
                  id="admin-token"
                  type="password"
                  placeholder="Enter the whitelist API admin token"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  className="max-w-md"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Required to deploy. Stored in this browser session only — never in the public bundle.
                </p>
              </div>

              {deployStatus === "success" && (
                <Alert variant="success" className="mb-4">
                  <CheckCircle className="size-4" />
                  <AlertDescription>
                    Whitelist deployed successfully!{" "}
                    {activeCount !== null ? activeCount : entries.length} addresses are now active.
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
                <Alert className="mb-4 border-[#0070f3]/20 bg-[#d3e5ff]/40">
                  <Link2 className="size-4 text-[#0761d1]" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium text-[#0761d1]">Merkle root generated.</span>{" "}
                    <span className="text-[#0761d1]/80">
                      Set it on the contract in{" "}
                      <a href="/admin/contract" className="underline">Contract management → Set Merkle root</a>{" "}
                      (owner wallet required) to enable whitelist minting.
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
                        {copied ? "Copied!" : "Copy"}
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
                      <th className="p-2 text-left font-medium">Address</th>
                      <th className="p-2 text-left font-medium">Mint limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, 100).map((entry, index) => (
                      <tr key={entry.address} className="border-t">
                        <td className="p-2 text-muted-foreground">{index + 1}</td>
                        <td className="p-2 font-mono text-xs">{entry.address}</td>
                        <td className="p-2">{entry.mintLimit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entries.length > 100 && (
                  <div className="border-t p-4 text-center text-sm text-muted-foreground">
                    Showing first 100 of {entries.length} addresses
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
                      Deploying...
                    </>
                  ) : (
                    `Deploy whitelist (${entries.length} addresses)`
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
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="mb-1 font-semibold">1. CSV format</h3>
              <p className="text-muted-foreground">
                Prepare a CSV file with Ethereum addresses and their mint limits.
                One address per line, separated by comma.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">2. Merkle tree generation</h3>
              <p className="text-muted-foreground">
                On deploy, the worker builds a Merkle tree (leaf = keccak256 of the
                address, matching the contract) and computes the Merkle root.
                Per-address proofs are stored in KV and served to minters.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">3. Contract update</h3>
              <p className="text-muted-foreground">
                Copy the generated Merkle root into Contract management → Set Merkle root
                (owner wallet). Whitelist minting is only enabled once the root is set on-chain.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">4. KV storage</h3>
              <p className="text-muted-foreground">
                Address data, limits, and proofs are stored in Cloudflare Workers KV
                and served to the mint page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
