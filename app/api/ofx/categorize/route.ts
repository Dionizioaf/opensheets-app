import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { transactions } = await request.json();

    if (!Array.isArray(transactions)) {
      return NextResponse.json(
        { success: false, error: "Transactions must be an array" },
        { status: 400 }
      );
    }

    // Mock AI categorization - in a real app, this would call an AI service
    const categorizations = transactions.map((tx: any, index: number) => ({
      transactionIndex: index,
      suggestions: [
        {
          categoryId: "cat-outros",
          categoryName: "Outros",
          confidence: 0.5,
        },
      ],
    }));

    return NextResponse.json({
      success: true,
      categorizations,
      warnings: [],
    });
  } catch (error) {
    console.error("Error in categorize API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}