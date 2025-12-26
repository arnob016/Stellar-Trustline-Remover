import { type NextRequest, NextResponse } from "next/server"
import { Keypair, Horizon } from "stellar-sdk"

const Server = Horizon.Server

const SERVERS = {
  public: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secretKey, network } = body as {
      secretKey: string
      network: "public" | "testnet"
    }

    if (!secretKey || !network) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!secretKey.startsWith('S') || secretKey.length !== 56) {
      return NextResponse.json({ error: "Invalid secret key format" }, { status: 400 })
    }

    if (network !== "public" && network !== "testnet") {
      return NextResponse.json({ error: "Invalid network" }, { status: 400 })
    }

    let keypair: InstanceType<typeof Keypair>
    try {
      keypair = Keypair.fromSecret(secretKey)
    } catch (e) {
      return NextResponse.json({ error: "Invalid secret key format" }, { status: 400 })
    }

    const server = new Server(SERVERS[network])
    const publicKey = keypair.publicKey()

    let response: any
    try {
      response = await server.claimableBalances().claimant(publicKey).limit(200).call()
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to fetch claimable balances"
      console.error("Claimable balances fetch error:", errorMsg)
      return NextResponse.json(
        { error: `Fetch error: ${errorMsg}` },
        { status: 400 },
      )
    }

    // Handle both _embedded.records (Python SDK style) and records (TypeScript SDK style)
    const records = response._embedded?.records || response.records || []

    if (!Array.isArray(records)) {
      return NextResponse.json({ balances: [] })
    }

    const balances = records
      .map((record: any) => {
        try {
          // Check if this account can actually claim it
          const canClaim = record.claimants && record.claimants.some((claimant: any) => claimant.destination === publicKey)

          if (!canClaim) {
            return null
          }

          // Parse asset information - handle both "CODE:ISSUER" and "native" formats
          let assetCode = "XLM"
          let assetIssuer = "native"

          if (record.asset && record.asset !== "native") {
            const assetParts = record.asset.split(":")
            if (assetParts.length === 2) {
              assetCode = assetParts[0]
              assetIssuer = assetParts[1]
            }
          }

          return {
            id: record.id,
            amount: record.amount,
            asset: assetCode,
            assetIssuer: assetIssuer,
            sponsor: record.sponsor || "Unknown",
          }
        } catch (e) {
          console.error("Error parsing balance record:", e, record)
          return null
        }
      })
      .filter((b: any) => b !== null)

    return NextResponse.json({ balances })
  } catch (error) {
    console.error("Error loading claimable balances:", error)
    const message = error instanceof Error ? error.message : "Failed to load claimable balances"
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
