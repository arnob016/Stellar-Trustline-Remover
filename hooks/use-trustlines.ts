"use client"

import { useState } from "react"

interface Trustline {
  assetCode: string
  assetIssuer: string
  balance: string
}

export function useLoadTrustlines(secretKey: string, network: "public" | "testnet") {
  const [trustlines, setTrustlines] = useState<Trustline[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadTrustlines = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/trustlines/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, network }),
      })

      if (!response.ok) throw new Error("Failed to load trustlines")

      const data = await response.json()
      setTrustlines(data.trustlines)
      return data.trustlines
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load trustlines"
      setError(message)
      setTrustlines([])
    } finally {
      setLoading(false)
    }
  }

  return { trustlines, loading, error, loadTrustlines }
}
