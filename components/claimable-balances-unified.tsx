"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, Check, X } from "lucide-react"
import { useClaimableBalances } from "@/hooks/use-claimable-balances"

interface BalanceAction {
  id: string
  action: "claim" | "reject"
}

interface UnifiedClaimableBalancesProps {
  secretKey: string
  network: "public" | "testnet"
}

export default function UnifiedClaimableBalances({ secretKey, network }: UnifiedClaimableBalancesProps) {
  const { balances, loading, error, loadBalances } = useClaimableBalances(secretKey, network)
  const [processing, setProcessing] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [balanceActions, setBalanceActions] = useState<Map<string, "claim" | "reject">>(new Map())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Auto-load balances on mount
  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  const handleLoad = async () => {
    const result = await loadBalances()
    if (result) {
      setSuccessMessage(`Loaded ${result.length} claimable balances`)
      setSelected(new Set())
      setBalanceActions(new Map())
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

  const setBalanceAction = (balanceId: string, action: "claim" | "reject") => {
    const newActions = new Map(balanceActions)
    newActions.set(balanceId, action)
    setBalanceActions(newActions)
  }

  const handleProcess = async (balanceId: string, action: "claim" | "reject") => {
    setProcessing(balanceId)
    setErrorMessage("")
    setSuccessMessage("")
    try {
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
        const errorMsg = data.error || `Failed to ${action} balance`
        throw new Error(errorMsg)
      }

      setSuccessMessage(`Successfully ${action}ed balance`)
      await handleLoad()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to ${action} balance`
      console.error(`Error ${action}ing balance:`, errorMsg)
      setErrorMessage(errorMsg)
    } finally {
      setProcessing(null)
    }
  }

  const handleBulkProcess = async () => {
    if (selected.size === 0) return

    setBulkProcessing(true)
    setErrorMessage("")
    setSuccessMessage("")

    const selectedBalances = balances.filter((b) => selected.has(b.id))

    try {
      let successCount = 0
      const errors: string[] = []

      for (const balance of selectedBalances) {
        const action = balanceActions.get(balance.id) || "claim"
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
            errors.push(`${balance.amount} ${balance.asset} (${action}): ${errorMsg}`)
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Network error"
          errors.push(`${balance.amount} ${balance.asset} (${action}): ${errorMsg}`)
        }
      }

      if (successCount > 0) {
        let message = `Processed ${successCount} balance${successCount !== 1 ? "s" : ""}`
        if (errors.length > 0) {
          message += ` (${errors.length} failed)`
        }
        setSuccessMessage(message)
      }

      if (errors.length > 0) {
        setErrorMessage(`Failed to process ${errors.length} balance${errors.length !== 1 ? "s" : ""}:\n${errors.join("\n")}`)
      }

      setSelected(new Set())
      setBalanceActions(new Map())
      await handleLoad()
    } catch (err) {
      console.error("Error in bulk processing:", err)
      setErrorMessage("An error occurred during processing")
    } finally {
      setBulkProcessing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Claimable Balances</CardTitle>
        <CardDescription>Claim or reject pending claimable balances to your account</CardDescription>
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

        {loading && !balances.length && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading balances...</span>
          </div>
        )}

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
              <div className="flex gap-2 p-3 bg-muted rounded-lg flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkProcess}
                  disabled={bulkProcessing || selected.size === 0}
                  className="flex-1 min-w-[200px]"
                >
                  {bulkProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Process {selected.size} Balance{selected.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelected(new Set())
                    setBalanceActions(new Map())
                  }}
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
                const action = balanceActions.get(balance.id) || "claim"
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
                    <div className="flex-1 min-w-0">
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

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleProcess(balance.id, "claim")}
                        disabled={processing === balance.id || bulkProcessing}
                      >
                        {processing === balance.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Claim
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleProcess(balance.id, "reject")}
                        disabled={processing === balance.id || bulkProcessing}
                      >
                        {processing === balance.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            Reject
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && balances.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No claimable balances found</p>
            <p className="text-sm mt-1">Click "Load Claimable Balances" to check for claimable balances</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
