import {
  categoryReportInputSchema,
  createTransactionInputSchema,
  listTransactionsInputSchema,
  transferInputSchema,
} from "../schemas";

describe("Opensheets MCP schemas", () => {
  it("applies bounded transaction pagination defaults", () => {
    const parsed = listTransactionsInputSchema.parse({ period: "2026-07" });

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
    expect(() =>
      listTransactionsInputSchema.parse({ limit: 101 })
    ).toThrow();
  });

  it("accepts a safe single expense transaction", () => {
    const parsed = createTransactionInputSchema.parse({
      idempotencyKey: "claude-2026-07-26-001",
      name: "Mercado",
      amount: 123.45,
      purchaseDate: "2026-07-26",
      transactionType: "Despesa",
      paymentMethod: "Pix",
      settled: true,
    });

    expect(parsed.amount).toBe(123.45);
    expect(parsed.settled).toBe(true);
  });

  it("rejects invalid periods, dates, and short idempotency keys", () => {
    expect(() =>
      createTransactionInputSchema.parse({
        idempotencyKey: "short",
        name: "Mercado",
        amount: 10,
        purchaseDate: "26/07/2026",
        transactionType: "Despesa",
        paymentMethod: "Pix",
      })
    ).toThrow();

    expect(() =>
      categoryReportInputSchema.parse({
        startPeriod: "2026-12",
        endPeriod: "2026-01",
      })
    ).toThrow();
  });

  it("rejects transfers to the same account", () => {
    const accountId = "f07902b7-2280-4aaf-a35b-0fe981262928";
    expect(() =>
      transferInputSchema.parse({
        idempotencyKey: "transfer-2026-07-26-001",
        fromAccountId: accountId,
        toAccountId: accountId,
        amount: 100,
        date: "2026-07-26",
      })
    ).toThrow("Source and destination accounts must be different.");
  });
});
