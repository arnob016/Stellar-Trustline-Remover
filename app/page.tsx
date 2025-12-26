"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Link2, Gift, Clock, Copy, Check, Eye, EyeOff, Send as SendIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import StellarHeader from "@/components/stellar-header"
import TrustlineManager from "@/components/trustline-manager"
import UnifiedClaimableBalances from "@/components/claimable-balances-unified"
import SendAsset from "@/components/send-asset"
import TransactionHistory from "@/components/transaction-history"
import NetworkSelector from "@/components/network-selector"
import { Keypair, Horizon } from "stellar-sdk"

export default function Home() {
  const [secretKey, setSecretKey] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [network, setNetwork] = useState<"public" | "testnet">("public")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [publicAddress, setPublicAddress] = useState("")
  const [xlmBalance, setXlmBalance] = useState("")
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [accountError, setAccountError] = useState("")
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copiedSecretKey, setCopiedSecretKey] = useState(false)

  // Fetch account info when authenticated
  useEffect(() => {
    if (!isAuthenticated || !secretKey) return

    const fetchAccountInfo = async () => {
      setBalanceLoading(true)
      setAccountError("")
      try {
        const keypair = Keypair.fromSecret(secretKey)
        const address = keypair.publicKey()
        setPublicAddress(address)

        const serverUrl = network === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org"
        const server = new Horizon.Server(serverUrl)
        const account = await server.loadAccount(address)

        const nativeBalance = account.balances.find((b: any) => b.asset_type === "native")
        setXlmBalance(nativeBalance?.balance || "0")
      } catch (err: any) {
        console.error("Failed to fetch account info:", err)
        // Check for 404 error - account not found
        const is404 = err.status === 404 || err.response?.status === 404 || err.message?.includes("404") || err.message?.includes("Not Found")
        
        if (is404) {
          setAccountError(`Account not found on ${network} network. Create the account first or switch networks.`)
        } else {
          setAccountError("Failed to load account information")
        }
        setXlmBalance("0")
      } finally {
        setBalanceLoading(false)
      }
    }

    fetchAccountInfo()
  }, [isAuthenticated, secretKey, network])

  const handleAuthenticate = async () => {
    if (!secretKey.trim()) {
      setError("Please enter your secret key")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Validate secret key format
      if (!secretKey.startsWith("S") || secretKey.length !== 56) {
        throw new Error("Invalid secret key format")
      }

      // Just store it in state for this session
      setIsAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate")
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setSecretKey("")
    setIsAuthenticated(false)
    setError("")
  }

  const copyAddressToClipboard = async () => {
    if (publicAddress) {
      await navigator.clipboard.writeText(publicAddress)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const copySecretKeyToClipboard = async () => {
    if (secretKey) {
      await navigator.clipboard.writeText(secretKey)
      setCopiedSecretKey(true)
      setTimeout(() => setCopiedSecretKey(false), 2000)
    }
  }

  const fundAccountWithFriendbot = async () => {
    if (!publicAddress || network !== "testnet") {
      return
    }

    setBalanceLoading(true)
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicAddress}`)
      if (!response.ok) {
        throw new Error("Failed to fund account with friendbot")
      }

      // Fetch account info again after funding
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const keypair = Keypair.fromSecret(secretKey)
      const address = keypair.publicKey()

      const server = new Horizon.Server("https://horizon-testnet.stellar.org")
      const account = await server.loadAccount(address)

      const nativeBalance = account.balances.find((b: any) => b.asset_type === "native")
      setXlmBalance(nativeBalance?.balance || "0")
      setAccountError("")
    } catch (err: any) {
      console.error("Failed to fund account:", err)
      setAccountError("Failed to fund account with friendbot. Please try again.")
    } finally {
      setBalanceLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-screen flex flex-col overflow-hidden">
        <StellarHeader />

        <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10 overflow-auto">
          <Card className="w-full max-w-md glass-lg">
            <CardHeader className="space-y-2 bg-gradient-to-b from-primary/10 to-transparent pb-6">
              <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Welcome to Stellar Manager</CardTitle>
              <CardDescription>Manage your trustlines, claim and reject claimable balances</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Secret Key</label>
                  <Input
                    type="password"
                    placeholder="S..."
                    value={secretKey}
                    onChange={(e) => {
                      setSecretKey(e.target.value)
                      setError("")
                    }}
                    className="font-mono border-primary/30 bg-input/50 backdrop-blur text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:shadow-lg focus:shadow-primary/20 transition-all"
                  />
                  <p className="text-xs text-muted-foreground/70">
                    Your secret key is never stored. It's only used during this session.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 backdrop-blur">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleAuthenticate} 
                  disabled={loading} 
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 text-primary-foreground font-semibold" 
                  size="lg"
                >
                  {loading ? "Authenticating..." : "Connect Account"}
                </Button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground/70 border-t border-border/30 pt-4">
                <p className="font-semibold text-foreground">Security Notice</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>This is a client-side application</li>
                  <li>Your secret key is never sent to any server</li>
                  <li>Session ends when you close the browser</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-screen flex flex-col overflow-hidden">
      <StellarHeader onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
          <div className="mb-8 glass-lg rounded-xl p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2">Stellar Account Manager</h1>
                <div className="flex items-center gap-4 mt-3">
                  <NetworkSelector value={network} onChange={setNetwork} />
                </div>
                {publicAddress && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Address:</p>
                      <span className="font-mono text-xs bg-input/50 px-2 py-1 rounded border border-primary/20 break-all">{publicAddress}</span>
                      <Button
                        onClick={copyAddressToClipboard}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-primary/20"
                        title="Copy address"
                      >
                        {copiedAddress ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">Secret Key:</p>
                      <span className="font-mono text-xs bg-input/50 px-2 py-1 rounded border border-primary/20 break-all">
                        {showSecretKey ? secretKey : "•".repeat(56)}
                      </span>
                      <Button
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-primary/20"
                        title={showSecretKey ? "Hide secret key" : "Show secret key"}
                      >
                        {showSecretKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {showSecretKey && (
                        <Button
                          onClick={copySecretKeyToClipboard}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-primary/20"
                          title="Copy secret key"
                        >
                          {copiedSecretKey ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    {accountError ? (
                      <div className="space-y-2">
                        <p className="text-sm text-red-400">{accountError}</p>
                        {network === "testnet" && accountError.includes("Account not found") && (
                          <Button
                            onClick={fundAccountWithFriendbot}
                            disabled={balanceLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                            size="sm"
                          >
                            {balanceLoading ? "Funding..." : "Fund with Friendbot"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        XLM Balance: <span className="font-semibold text-accent">{balanceLoading ? "..." : `${xlmBalance} XLM`}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Tabs defaultValue="trustlines" className="w-full">
          <TabsList className="glass grid w-full grid-cols-4 p-1 rounded-lg">
            <TabsTrigger value="trustlines" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Trustlines</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
              <SendIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </TabsTrigger>
            <TabsTrigger value="claimable" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Claimable Balances</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trustlines" className="mt-6">
            <TrustlineManager secretKey={secretKey} network={network} />
          </TabsContent>

          <TabsContent value="send" className="mt-6">
            <SendAsset secretKey={secretKey} network={network} />
          </TabsContent>

          <TabsContent value="claimable" className="mt-6">
            <UnifiedClaimableBalances secretKey={secretKey} network={network} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <TransactionHistory secretKey={secretKey} network={network} />
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  )
}
