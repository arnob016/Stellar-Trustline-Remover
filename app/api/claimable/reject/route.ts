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
    const { secretKey, network, balanceId } = body as {
      secretKey: string
      network: "public" | "testnet"
      balanceId: string
    }

    if (!secretKey || !network || !balanceId) {
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

    let balanceRecord: any
    try {
      balanceRecord = await server.claimableBalances().claimableBalance(balanceId).call()
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load balance"
      console.error("Balance load error:", errorMsg)
      return NextResponse.json(
        { error: `Balance error: ${errorMsg}` },
        { status: 400 },
      )
    }

    const sponsor = balanceRecord.sponsor
    const amount = balanceRecord.amount
    
    let asset: any = null
    if (balanceRecord.asset && balanceRecord.asset !== "native") {
      const assetParts = balanceRecord.asset.split(":")
      if (assetParts.length === 2) {
        asset = new Asset(assetParts[0], assetParts[1])
      }
    }

    const networkPassphrase = NETWORKS[network]

    try {
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: networkPassphrase,
      })

      // Add trustline first if the asset is non-native (needed to hold the asset)
      if (asset) {
        builder.addOperation(
          Operation.changeTrust({
            asset: asset,
            limit: "922337203685.4775807", // Maximum limit
          }),
        )
      }

      const transaction = builder
        .addOperation(
          Operation.claimClaimableBalance({
            balanceId,
          }),
        )
        .addOperation(
          Operation.payment({
            destination: sponsor,
            asset: asset || Asset.native(),
            amount: amount,
          }),
        )
        // Remove trustline if it was a non-native asset (clean up after rejection)
        .addOperation(
          Operation.changeTrust({
            asset: asset || Asset.native(),
            limit: "0",
          }),
        )
        .setTimeout(180)
        .build()

      transaction.sign(keypair)
      const response = await server.submitTransaction(transaction)

      return NextResponse.json({ 
        success: true, 
        message: "Balance rejected",
        hash: (response as any).hash
      })
    } catch (e) {
      let errorMsg = "Failed to reject balance"
      if (e instanceof Error) {
        errorMsg = e.message
        // Extract Horizon error details if available
        if ((e as any).response?.data?.extras?.result_codes) {
          const extras = (e as any).response.data.extras
          errorMsg = `Transaction failed: ${JSON.stringify(extras.result_codes)}`
        }
      }
      console.error("Transaction error:", errorMsg)
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error rejecting balance:", error)
    const message = error instanceof Error ? error.message : "Failed to reject balance"
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
