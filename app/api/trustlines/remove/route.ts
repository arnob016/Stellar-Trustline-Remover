import { type NextRequest, NextResponse } from "next/server"
import { Keypair, Horizon, TransactionBuilder, Networks, Asset, Operation, BASE_FEE } from "stellar-sdk"

const Server = Horizon.Server

const NETWORKS = {
  public: Networks.PUBLIC,
  testnet: Networks.TESTNET,
}

const SERVERS = {
  public: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secretKey, network, assetCode, assetIssuer } = body as {
      secretKey: string
      network: "public" | "testnet"
      assetCode: string
      assetIssuer: string
    }

    if (!secretKey || !network || !assetCode || !assetIssuer) {
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

    const asset = new Asset(assetCode, assetIssuer)
    const networkPassphrase = NETWORKS[network]
    
    // Find the trustline balance for this asset
    let trustlineBalance = "0"
    const balances = account.balances as any[]
    const trustline = balances.find((b: any) => 
      b.asset_code === assetCode && b.asset_issuer === assetIssuer
    )
    
    if (trustline && trustline.balance && trustline.balance !== "0") {
      trustlineBalance = trustline.balance
    }
    
    try {
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: networkPassphrase,
      })

      // If there's a balance, send it back to the issuer first
      if (trustlineBalance !== "0") {
        builder.addOperation(
          Operation.payment({
            destination: assetIssuer,
            asset: asset,
            amount: trustlineBalance,
          }),
        )
      }

      // Then remove the trustline
      const transaction = builder
        .addOperation(
          Operation.changeTrust({
            asset,
            limit: "0",
          }),
        )
        .setTimeout(180)
        .build()

      transaction.sign(keypair)
      const response = await server.submitTransaction(transaction)

      return NextResponse.json({ 
        success: true, 
        message: "Trustline removed",
        hash: (response as any).hash
      })
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to remove trustline"
      console.error("Transaction error:", errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error removing trustline:", error)
    const message = error instanceof Error ? error.message : "Failed to remove trustline"
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
