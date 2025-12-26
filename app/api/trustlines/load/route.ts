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

    let account: any
    try {
      account = await server.loadAccount(publicKey)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load account"
      console.error("Account load error:", errorMsg)
      return NextResponse.json(
        { error: `Account error: ${errorMsg}` },
        { status: 400 },
      )
    }

    if (!account.balances || !Array.isArray(account.balances)) {
      return NextResponse.json({ trustlines: [] })
    }

    const trustlines = account.balances
      .filter((balance: any) => balance.asset_type !== "native")
      .map((balance: any) => ({
        assetCode: balance.asset_code,
        assetIssuer: balance.asset_issuer,
        balance: balance.balance,
      }))

    return NextResponse.json({ trustlines })
  } catch (error) {
    console.error("Error loading trustlines:", error)
    const message = error instanceof Error ? error.message : "Failed to load trustlines"
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
