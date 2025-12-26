"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, Loader2, Trash2 } from "lucide-react"
import { useLoadTrustlines } from "@/hooks/use-trustlines"

interface TrustlineManagerProps {
  secretKey: string
  network: "public" | "testnet"
}

export default function TrustlineManager({ secretKey, network }: TrustlineManagerProps) {
  const { trustlines, loading, error, loadTrustlines } = useLoadTrustlines(secretKey, network)
  const [removing, setRemoving] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRemoving, setBulkRemoving] = useState(false)

  // Auto-load trustlines when component mounts or secretKey/network changes
  useEffect(() => {
    if (secretKey) {
      loadTrustlines()
    }
  }, [secretKey, network])

  const handleLoadTrustlines = async () => {
    const result = await loadTrustlines()
    if (result) {
      setSuccessMessage(`Loaded ${result.length} trustlines`)
      setSelected(new Set()) // Clear selection on reload
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const toggleSelectAll = () => {
    if (selected.size === trustlines.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(trustlines.map((t) => `${t.assetCode}:${t.assetIssuer}`)))
    }
  }

  const handleRemoveTrustline = async (assetCode: string, assetIssuer: string) => {
    setRemoving(`${assetCode}:${assetIssuer}`)
    setErrorMessage("")
    setSuccessMessage("")
    try {
      const response = await fetch("/api/trustlines/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey,
          network,
          assetCode,
          assetIssuer,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || "Failed to remove trustline"
        throw new Error(errorMessage)
      }

      setSuccessMessage(`Removed trustline: ${assetCode}`)
      await handleLoadTrustlines()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to remove trustline"
      console.error("Error removing trustline:", err)
      setErrorMessage(errorMessage)
    } finally {
      setRemoving(null)
    }
  }

  const handleBulkRemove = async () => {
    if (selected.size === 0) return

    setBulkRemoving(true)
    setErrorMessage("")
    setSuccessMessage("")
    const selectedTrustlines = trustlines.filter(
      (t) => selected.has(`${t.assetCode}:${t.assetIssuer}`),
    )

    try {
      let successCount = 0
      const errors: string[] = []

      for (const trustline of selectedTrustlines) {
        try {
          const response = await fetch("/api/trustlines/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secretKey,
              network,
              assetCode: trustline.assetCode,
              assetIssuer: trustline.assetIssuer,
            }),
          })

          const data = await response.json()

          if (response.ok) {
            successCount++
          } else {
            const errorMsg = data.error || "Unknown error"
            errors.push(`${trustline.assetCode}: ${errorMsg}`)
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Network error"
          errors.push(`${trustline.assetCode}: ${errorMsg}`)
        }
      }

      if (successCount > 0) {
        let message = `Removed ${successCount} trustline${successCount !== 1 ? "s" : ""}`
        if (errors.length > 0) {
          message += ` (${errors.length} failed)`
        }
        setSuccessMessage(message)
      }

      if (errors.length > 0) {
        setErrorMessage(`Failed to remove ${errors.length} trustline${errors.length !== 1 ? "s" : ""}:\n${errors.join("\n")}`)
      }

      setSelected(new Set())
      await handleLoadTrustlines()
    } catch (err) {
      console.error("Error in bulk removal:", err)
      setErrorMessage("An error occurred during bulk removal")
    } finally {
      setBulkRemoving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Trustlines</CardTitle>
        <CardDescription>View and remove trustlines from your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {successMessage && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 text-sm whitespace-pre-wrap">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleLoadTrustlines} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading Trustlines...
            </>
          ) : (
            "Load Trustlines"
          )}
        </Button>

        {trustlines.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Found {trustlines.length} trustlines</p>
              {selected.size > 0 && (
                <span className="text-xs bg-blue-500/10 text-blue-700 px-2 py-1 rounded">
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Bulk action buttons */}
            {selected.size > 0 && (
              <div className="flex gap-2 p-3 bg-muted rounded-lg">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkRemove}
                  disabled={bulkRemoving}
                  className="flex-1"
                >
                  {bulkRemoving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove {selected.size} Trustline{selected.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkRemoving}
                >
                  Clear Selection
                </Button>
              </div>
            )}

            {/* Select all checkbox */}
            {trustlines.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                <Checkbox
                  checked={selected.size === trustlines.length && trustlines.length > 0}
                  onCheckedChange={() => toggleSelectAll()}
                  disabled={bulkRemoving}
                />
                <span className="text-sm font-medium">Select All</span>
              </div>
            )}

            {/* Trustline list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trustlines.map((trustline) => {
                const id = `${trustline.assetCode}:${trustline.assetIssuer}`
                const isSelected = selected.has(id)
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-card border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(id)}
                      disabled={removing === id || bulkRemoving}
                    />
                    <div className="flex-1">
                      <p className="font-mono text-sm font-semibold">{trustline.assetCode}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {trustline.assetIssuer.slice(0, 10)}...{trustline.assetIssuer.slice(-8)}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveTrustline(trustline.assetCode, trustline.assetIssuer)}
                      disabled={removing === id || bulkRemoving}
                    >
                      {removing === id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && trustlines.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No trustlines loaded yet</p>
            <p className="text-sm mt-1">Click "Load Trustlines" to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
