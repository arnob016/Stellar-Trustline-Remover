import { NextRequest, NextResponse } from "next/server"
import { Horizon } from "stellar-sdk"

export async function POST(request: NextRequest) {
  try {
    const { address, network } = await request.json()

    if (!address) {
      return NextResponse.json(
        { error: "Missing address parameter" },
        { status: 400 }
      )
    }

    const serverUrl =
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org"

    const server = new Horizon.Server(serverUrl)

    // Fetch transactions for the address
    const transactionsResponse = await server
      .transactions()
      .forAccount(address)
      .limit(50)
      .order("desc")
      .call()

    const transactions = transactionsResponse.records.map((tx: any) => ({
      id: tx.id,
      hash: tx.hash,
      created_at: tx.created_at,
      source_account: tx.source_account,
      operation_count: tx.operation_count,
      successful: tx.successful,
      memo: tx.memo_type && tx.memo ? `${tx.memo_type}: ${tx.memo}` : undefined,
    }))

    return NextResponse.json({
      transactions,
      count: transactions.length,
    })
  } catch (error: any) {
    console.error("Error fetching transactions:", error)

    const statusCode = error.status || 500
    const errorMessage =
      error.message || "Failed to fetch transaction history from Horizon"

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
