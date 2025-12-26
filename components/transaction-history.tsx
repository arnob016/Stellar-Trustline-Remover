"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircle, RefreshCw, Download, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: string
  hash: string
  created_at: string
  source_account: string
  operation_count: number
  successful: boolean
  type?: string
  amount?: string
  asset?: string
  memo?: string
}

interface TransactionHistoryProps {
  secretKey: string
  network: "public" | "testnet"
}

export default function TransactionHistory({ secretKey, network }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [publicAddress, setPublicAddress] = useState("")
  const { toast } = useToast()

  // Fetch public address from secret key
  useEffect(() => {
    try {
      const { Keypair } = require("stellar-sdk")
      const keypair = Keypair.fromSecret(secretKey)
      setPublicAddress(keypair.publicKey())
    } catch (err) {
      setError("Failed to derive address from secret key")
    }
  }, [secretKey])

  // Auto-load transactions when component mounts or dependencies change
  useEffect(() => {
    if (publicAddress) {
      fetchTransactions()
    }
  }, [publicAddress, network])

  const fetchTransactions = async () => {
    if (!publicAddress) {
      setError("Address not available")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/transactions/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: publicAddress,
          network,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()
      setTransactions(data.transactions || [])

      if (data.transactions?.length === 0) {
        toast({
          title: "No transactions found",
          description: "This account has no transaction history yet.",
        })
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch transaction history"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (transactions.length === 0) {
      toast({
        title: "No data to download",
        description: "There are no transactions to export.",
      })
      return
    }

    const headers = ["Transaction ID", "Hash", "Date", "Created By", "Operations", "Status"]
    const rows = transactions.map((tx) => [
      tx.id,
      tx.hash,
      new Date(tx.created_at).toLocaleString(),
      tx.source_account,
      tx.operation_count,
      tx.successful ? "Success" : "Failed",
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Downloaded",
      description: "Transaction history exported to CSV.",
    })
  }

  const openInExplorer = (txHash: string) => {
    const explorerUrl = network === "testnet" 
      ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
      : `https://stellar.expert/explorer/public/tx/${txHash}`
    window.open(explorerUrl, "_blank")
  }

  return (
    <div className="space-y-6">
      <Card className="glass-lg border-primary/20">
        <CardHeader className="space-y-2 bg-gradient-to-b from-primary/10 to-transparent pb-6">
          <CardTitle className="text-2xl">Transaction History</CardTitle>
          <CardDescription>View all transactions for your Stellar account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 backdrop-blur">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={fetchTransactions}
              disabled={loading || !publicAddress}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Load Transactions
                </>
              )}
            </Button>

            {transactions.length > 0 && (
              <Button
                onClick={downloadCSV}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>

          {transactions.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/30 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Transaction ID</TableHead>
                    <TableHead className="text-xs font-semibold">Created By</TableHead>
                    <TableHead className="text-xs font-semibold">Operations</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.hash.slice(0, 16)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.source_account.slice(0, 10)}...{tx.source_account.slice(-8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="bg-accent/20 text-accent hover:bg-accent/30">
                          {tx.operation_count} ops
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.successful ? "default" : "destructive"}
                          className={
                            tx.successful
                              ? "bg-green-500/20 text-green-600 hover:bg-green-500/30"
                              : "bg-red-500/20 text-red-600 hover:bg-red-500/30"
                          }
                        >
                          {tx.successful ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => openInExplorer(tx.hash)}
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-primary hover:bg-primary/10"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && transactions.length === 0 && !error && (
            <div className="text-center py-12 space-y-4">
              <p className="text-muted-foreground">No transactions loaded yet</p>
              <p className="text-sm text-muted-foreground/70">
                Click "Load Transactions" to fetch your account's transaction history
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
