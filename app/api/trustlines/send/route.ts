import { NextRequest, NextResponse } from "next/server"
import { Keypair, TransactionBuilder, Networks, Asset, Horizon } from "stellar-sdk"

export async function POST(request: NextRequest) {
  try {
    const { secretKey, network, recipientAddress, assetCode, assetIssuer, amount } = await request.json()

    if (!secretKey || !recipientAddress || !assetCode || !amount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    const keypair = Keypair.fromSecret(secretKey)
    const sourceAddress = keypair.publicKey()

    const serverUrl =
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org"

    const server = new Horizon.Server(serverUrl)
    const sourceAccount = await server.loadAccount(sourceAddress)

    // Create asset object
    let asset: Asset
    if (assetCode === "XLM") {
      asset = Asset.native()
    } else {
      if (!assetIssuer) {
        return NextResponse.json(
          { error: "Asset issuer is required for non-native assets" },
          { status: 400 }
        )
      }
      asset = new Asset(assetCode, assetIssuer)
    }

    // Build transaction
    const networkPassphrase =
      network === "testnet" ? Networks.TESTNET_NETWORK_PASSPHRASE : Networks.PUBLIC_NETWORK_PASSPHRASE

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(
        sourceAccount.operations.payment({
          destination: recipientAddress,
          asset: asset,
          amount: amount.toString(),
        })
      )
      .setTimeout(30)
      .build()

    transaction.sign(keypair)

    // Submit transaction
    const response = await server.submitTransaction(transaction)

    return NextResponse.json({
      success: true,
      transactionHash: response.hash,
      message: `Successfully sent ${amount} ${assetCode} to ${recipientAddress}`,
    })
  } catch (error: any) {
    console.error("Error sending asset:", error)

    let statusCode = 500
    let errorMessage = "Failed to send asset"

    if (error.message?.includes("Invalid")) {
      statusCode = 400
      errorMessage = error.message
    } else if (error.response?.status === 400) {
      statusCode = 400
      errorMessage = error.response?.data?.title || error.message
    } else if (error.message?.includes("Not Found")) {
      statusCode = 404
      errorMessage = "Recipient account not found"
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
