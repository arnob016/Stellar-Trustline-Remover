"use client"

import { useState } from "react"

interface ClaimableBalance {
  id: string
  amount: string
  asset: string
  assetIssuer: string
  sponsor?: string
}

export function useClaimableBalances(secretKey: string, network: "public" | "testnet") {
  const [balances, setBalances] = useState<ClaimableBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadBalances = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/claimable/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, network }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to load claimable balances")
      }

      const data = await response.json()
      setBalances(data.balances)
      return data.balances
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load balances"
      setError(message)
      setBalances([])
      return null
    } finally {
      setLoading(false)
    }
  }

  return { balances, loading, error, loadBalances }
}
