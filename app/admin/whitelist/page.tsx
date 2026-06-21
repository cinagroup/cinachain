"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"

interface WhitelistEntry {
  address: string
  mintLimit: number
}

export default function WhitelistManagementPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

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
        
        if (isNaN(limit) || limit < 1) {
          throw new Error(`Invalid mint limit at line ${i + 1}: ${parts[1]}`)
        }
        
        parsedEntries.push({ address: address.toLowerCase(), mintLimit: limit })
      }
      
      setEntries(parsedEntries)
      setUploadStatus("success")
    } catch (error) {
      setUploadStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Failed to parse CSV file")
      setEntries([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeployWhitelist = async () => {
    // TODO: Implement actual deployment to Cloudflare Workers KV
    alert(`Deploying ${entries.length} addresses to whitelist...\n\nThis would upload to Cloudflare Workers KV and update the Merkle root on the contract.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display">Whitelist Management</h1>
        <p className="text-muted-foreground mt-1">
          Upload and manage whitelist addresses for the minting process
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Whitelist CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file with addresses and mint limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="max-w-xs mx-auto"
            />
            <p className="text-sm text-muted-foreground mt-4">
              CSV format: <code className="bg-muted px-2 py-1 rounded">address,limit</code>
              <br />
              Example: <code className="bg-muted px-2 py-1 rounded">0x123...abc,3</code>
            </p>
          </div>

          {uploadStatus === "success" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully parsed {entries.length} addresses from CSV file
              </AlertDescription>
            </Alert>
          )}

          {uploadStatus === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Preview ({entries.length} addresses)
            </CardTitle>
            <CardDescription>
              Review the addresses before deploying to the whitelist
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">Address</th>
                    <th className="text-left p-2 font-medium">Mint Limit</th>
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
                <div className="p-4 text-center text-sm text-muted-foreground border-t">
                  Showing first 100 of {entries.length} addresses
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleDeployWhitelist}
                className="flex-1"
              >
                Deploy Whitelist ({entries.length} addresses)
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEntries([])
                  setUploadStatus("idle")
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
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-1">1. CSV Format</h3>
            <p className="text-muted-foreground">
              Prepare a CSV file with Ethereum addresses and their mint limits.
              One address per line, separated by comma.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">2. Merkle Tree Generation</h3>
            <p className="text-muted-foreground">
              The system generates a Merkle Tree from the addresses and computes the Merkle Root.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">3. Contract Update</h3>
            <p className="text-muted-foreground">
              The Merkle Root is submitted to the smart contract, enabling whitelist minting.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">4. KV Storage</h3>
            <p className="text-muted-foreground">
              Address data is stored in Cloudflare Workers KV for proof generation during minting.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
