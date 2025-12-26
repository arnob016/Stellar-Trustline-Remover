"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, Loader2, Check, X } from "lucide-react"
import { useClaimableBalances } from "@/hooks/use-claimable-balances"

interface ClaimableBalancesProps {
  secretKey: string
  network: "public" | "testnet"
  mode: "claim" | "reject"
}

export default function ClaimableBalances({ secretKey, network, mode }: ClaimableBalancesProps) {
  const { balances, loading, error, loadBalances } = useClaimableBalances(secretKey, network)
  const [processing, setProcessing] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const handleLoad = async () => {
    const result = await loadBalances()
    if (result) {
      setSuccessMessage(`Loaded ${result.length} claimable balances`)
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
    if (selected.size === balances.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(balances.map((b) => b.id)))
    }
  }

  const handleProcess = async (balanceId: string) => {
    setProcessing(balanceId)
    try {
      const action = mode === "claim" ? "claim" : "reject"
      const response = await fetch(`/api/claimable/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretKey,
          network,
          balanceId,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        const errorMessage = data.error || `Failed to ${action} balance`
        throw new Error(errorMessage)
      }

      setSuccessMessage(`Successfully ${mode}ed balance`)
      await handleLoad()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to ${mode} balance`
      console.error(`Error ${mode}ing balance:`, errorMsg)
      setSuccessMessage("")
    } finally {
      setProcessing(null)
    }
  }

  const handleBulkProcess = async () => {
    if (selected.size === 0) return

    setBulkProcessing(true)
    const selectedBalances = balances.filter((b) => selected.has(b.id))
    const action = mode === "claim" ? "claim" : "reject"

    try {
      let successCount = 0
      const errors: string[] = []

      for (const balance of selectedBalances) {
        try {
          const response = await fetch(`/api/claimable/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secretKey,
              network,
              balanceId: balance.id,
            }),
          })

          const data = await response.json()

          if (response.ok) {
            successCount++
          } else {
            const errorMsg = data.error || "Unknown error"
            errors.push(`${balance.amount} ${balance.asset}: ${errorMsg}`)
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Network error"
          errors.push(`${balance.amount} ${balance.asset}: ${errorMsg}`)
        }
      }

      if (successCount > 0) {
        let message = `${mode === "claim" ? "Claimed" : "Rejected"} ${successCount} balance${successCount !== 1 ? "s" : ""}`
        if (errors.length > 0) {
          message += ` (${errors.length} failed)`
          console.error("Bulk process errors:", errors)
        }
        setSuccessMessage(message)
      } else if (errors.length > 0) {
        setSuccessMessage(`Failed to ${action} balances: ${errors[0]}`)
      }

      setSelected(new Set())
      await handleLoad()
    } catch (err) {
      console.error(`Error in bulk ${action}:`, err)
      setSuccessMessage("")
    } finally {
      setBulkProcessing(false)
    }
  }

  const title = mode === "claim" ? "Claim Claimable Balances" : "Reject Claimable Balances"
  const description =
    mode === "claim" ? "Claim pending claimable balances to your account" : "Reject pending claimable balances"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {successMessage && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleLoad} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading Balances...
            </>
          ) : (
            `Load ${mode === "claim" ? "Claimable" : "Rejectable"} Balances`
          )}
        </Button>

        {balances.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Found {balances.length} claimable balances</p>
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
                  variant={mode === "claim" ? "default" : "destructive"}
                  size="sm"
                  onClick={handleBulkProcess}
                  disabled={bulkProcessing}
                  className="flex-1"
                >
                  {bulkProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : mode === "claim" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Claim {selected.size} Balance{selected.size !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Reject {selected.size} Balance{selected.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkProcessing}
                >
                  Clear Selection
                </Button>
              </div>
            )}

            {/* Select all checkbox */}
            {balances.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                <Checkbox
                  checked={selected.size === balances.length && balances.length > 0}
                  onCheckedChange={() => toggleSelectAll()}
                  disabled={bulkProcessing}
                />
                <span className="text-sm font-medium">Select All</span>
              </div>
            )}

            {/* Balance list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {balances.map((balance) => {
                const isSelected = selected.has(balance.id)
                return (
                  <div
                    key={balance.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-card border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(balance.id)}
                      disabled={processing === balance.id || bulkProcessing}
                    />
                    <div className="flex-1">
                      <p className="font-mono text-sm font-semibold">
                        {balance.amount} {balance.asset}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {balance.id.slice(0, 16)}...{balance.id.slice(-8)}
                      </p>
                      {balance.sponsor && (
                        <p className="text-xs text-muted-foreground mt-1">Sponsor: {balance.sponsor.slice(0, 10)}...</p>
                      )}
                    </div>
                    <Button
                      variant={mode === "claim" ? "default" : "destructive"}
                      size="sm"
                      onClick={() => handleProcess(balance.id)}
                      disabled={processing === balance.id || bulkProcessing}
                    >
                      {processing === balance.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : mode === "claim" ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Claim
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && balances.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No claimable balances found</p>
            <p className="text-sm mt-1">Click "Load Balances" to check for claimable balances</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
