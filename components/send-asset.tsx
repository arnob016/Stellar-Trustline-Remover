"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Keypair, Horizon } from "stellar-sdk"

interface Asset {
  code: string
  issuer?: string
  balance: string
}

interface SendAssetProps {
  secretKey: string
  network: "public" | "testnet"
}

export default function SendAsset({ secretKey, network }: SendAssetProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [publicAddress, setPublicAddress] = useState("")

  const [selectedAsset, setSelectedAsset] = useState<string>("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const { toast } = useToast()

  // Derive address and load assets
  useEffect(() => {
    try {
      const keypair = Keypair.fromSecret(secretKey)
      setPublicAddress(keypair.publicKey())
    } catch (err) {
      setError("Failed to derive address from secret key")
    }
  }, [secretKey])

  useEffect(() => {
    if (publicAddress) {
      fetchAssets()
    }
  }, [publicAddress, network])

  const fetchAssets = async () => {
    if (!publicAddress) return

    setLoading(true)
    setError("")

    try {
      const serverUrl = network === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org"
      const server = new Horizon.Server(serverUrl)
      const account = await server.loadAccount(publicAddress)

      const assetsList: Asset[] = []

      account.balances.forEach((balance: any) => {
        if (balance.asset_type === "native") {
          assetsList.push({
            code: "XLM",
            balance: balance.balance,
          })
        } else {
          assetsList.push({
            code: balance.asset_code,
            issuer: balance.asset_issuer,
            balance: balance.balance,
          })
        }
      })

      setAssets(assetsList)
      if (assetsList.length > 0) {
        setSelectedAsset(`${assetsList[0].code}:${assetsList[0].issuer || "native"}`)
      }
    } catch (err: any) {
      setError("Failed to load assets")
      console.error("Error loading assets:", err)
    } finally {
      setLoading(false)
    }
  }

  const getSelectedAssetDetails = () => {
    const [code, issuer] = selectedAsset.split(":")
    return assets.find((a) => a.code === code && (a.issuer || "native") === issuer)
  }

  const handleSendAsset = async () => {
    setError("")

    // Validation
    if (!selectedAsset) {
      setError("Please select an asset")
      return
    }

    if (!recipientAddress.trim()) {
      setError("Please enter a recipient address")
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    const selectedAssetDetails = getSelectedAssetDetails()
    if (!selectedAssetDetails) {
      setError("Selected asset not found")
      return
    }

    if (parseFloat(amount) > parseFloat(selectedAssetDetails.balance)) {
      setError(`Insufficient balance. Maximum: ${selectedAssetDetails.balance} ${selectedAssetDetails.code}`)
      return
    }

    setSending(true)

    try {
      const response = await fetch("/api/trustlines/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secretKey,
          network,
          recipientAddress,
          assetCode: selectedAssetDetails.code,
          assetIssuer: selectedAssetDetails.issuer,
          amount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send asset")
      }

      toast({
        title: "Success",
        description: `Sent ${amount} ${selectedAssetDetails.code} to ${recipientAddress.slice(0, 10)}...`,
      })

      // Reset form
      setRecipientAddress("")
      setAmount("")

      // Refresh assets
      await fetchAssets()
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send asset"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const selectedAssetDetails = getSelectedAssetDetails()
  const maxAmount = selectedAssetDetails?.balance || "0"

  return (
    <div className="space-y-6">
      <Card className="glass-lg border-primary/20">
        <CardHeader className="space-y-2 bg-gradient-to-b from-primary/10 to-transparent pb-6">
          <CardTitle className="text-2xl">Send Asset</CardTitle>
          <CardDescription>Send any asset to another Stellar account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 backdrop-blur">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading assets...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Asset Selection and Amount */}
              <div className="space-y-2">
                <Label>Asset & Amount</Label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger className="bg-input/50 border-primary/30">
                        <SelectValue placeholder="Select an asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem
                            key={`${asset.code}:${asset.issuer || "native"}`}
                            value={`${asset.code}:${asset.issuer || "native"}`}
                          >
                            {asset.code} (Balance: {asset.balance})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAssetDetails && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: <span className="font-semibold">{selectedAssetDetails.balance}</span> {selectedAssetDetails.code}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value)
                        setError("")
                      }}
                      step="0.0000001"
                      min="0"
                      className="bg-input/50 border-primary/30"
                    />
                    {selectedAssetDetails && (
                      <Button
                        onClick={() => setAmount(selectedAssetDetails.balance)}
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        Max
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="G..."
                  value={recipientAddress}
                  onChange={(e) => {
                    setRecipientAddress(e.target.value)
                    setError("")
                  }}
                  className="font-mono bg-input/50 border-primary/30"
                />
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendAsset}
                disabled={sending || loading || assets.length === 0}
                className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 text-primary-foreground font-semibold"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Asset
                  </>
                )}
              </Button>

              {assets.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No assets available to send</p>
                  <p className="text-sm mt-1">You need to have at least one asset balance</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
