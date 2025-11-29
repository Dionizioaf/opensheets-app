import { getUserId } from "@/lib/auth/server";
import { findBatchTransactionDuplicates } from "@/lib/ofx-parser/duplicate-detection";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { transactions, accountId } = await request.json();

    if (!transactions || !accountId) {
      return NextResponse.json(
        { error: "Missing required fields: transactions and accountId" },
        { status: 400 }
      );
    }

    // Validate transaction format
    if (!Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Transactions must be an array" },
        { status: 400 }
      );
    }

    // Convert transactions to the expected format
    const formattedTransactions = transactions.map((tx: any) => ({
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      payee: tx.payee,
    }));

    // Perform duplicate detection
    const duplicateResults = await findBatchTransactionDuplicates(
      userId,
      accountId,
      formattedTransactions,
      90 // Look back 90 days
    );

    return NextResponse.json({
      success: true,
      data: duplicateResults,
    });
  } catch (error) {
    console.error("Error in duplicate detection API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}