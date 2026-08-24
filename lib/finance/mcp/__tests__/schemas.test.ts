import {
  anticipateInstallmentsInputSchema,
  categoryReportInputSchema,
  createTransactionInputSchema,
  deleteSeriesInputSchema,
  deleteTransactionInputSchema,
  updateSeriesInputSchema,
  listTransactionsInputSchema,
  mcpMutationModeSchema,
  payInvoiceInputSchema,
  reverseInvoicePaymentInputSchema,
  reverseTransferInputSchema,
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

  it("defaults the mutation mode to preview", () => {
    expect(mcpMutationModeSchema.parse(undefined)).toBe("preview");
    expect(mcpMutationModeSchema.parse("apply")).toBe("apply");
    expect(() => mcpMutationModeSchema.parse("destroy")).toThrow();
  });

  it("defaults high-risk tools to preview mode", () => {
    const del = deleteTransactionInputSchema.parse({
      idempotencyKey: "delete-2026-07-26-001",
      transactionId: "f07902b7-2280-4aaf-a35b-0fe981262928",
    });
    expect(del.mode).toBe("preview");

    const reverse = reverseTransferInputSchema.parse({
      idempotencyKey: "reverse-2026-07-26-001",
      transferId: "f07902b7-2280-4aaf-a35b-0fe981262928",
      mode: "apply",
    });
    expect(reverse.mode).toBe("apply");
  });

  it("defaults invoice tools to preview and requires a period", () => {
    const pay = payInvoiceInputSchema.parse({
      idempotencyKey: "pay-2026-07-26-001",
      cardId: "f07902b7-2280-4aaf-a35b-0fe981262928",
      period: "2026-07",
    });
    expect(pay.mode).toBe("preview");

    const reverse = reverseInvoicePaymentInputSchema.parse({
      idempotencyKey: "reverse-invoice-2026-07-26-001",
      cardId: "f07902b7-2280-4aaf-a35b-0fe981262928",
      period: "2026-07",
      mode: "apply",
    });
    expect(reverse.mode).toBe("apply");

    expect(() =>
      payInvoiceInputSchema.parse({
        idempotencyKey: "pay-2026-07-26-002",
        cardId: "f07902b7-2280-4aaf-a35b-0fe981262928",
        period: "2026-7",
      })
    ).toThrow();
  });

  it("defaults series tools to preview and requires a change", () => {
    const anchor = "f07902b7-2280-4aaf-a35b-0fe981262928";

    const del = deleteSeriesInputSchema.parse({
      idempotencyKey: "delete-series-2026-07-26-001",
      transactionId: anchor,
      scope: "future",
    });
    expect(del.mode).toBe("preview");

    const update = updateSeriesInputSchema.parse({
      idempotencyKey: "update-series-2026-07-26-001",
      transactionId: anchor,
      scope: "all",
      note: "Assinatura anual",
      mode: "apply",
    });
    expect(update.mode).toBe("apply");

    // An update that changes nothing is rejected.
    expect(() =>
      updateSeriesInputSchema.parse({
        idempotencyKey: "update-series-2026-07-26-002",
        transactionId: anchor,
        scope: "current",
      })
    ).toThrow();

    // Invalid scope is rejected.
    expect(() =>
      deleteSeriesInputSchema.parse({
        idempotencyKey: "delete-series-2026-07-26-003",
        transactionId: anchor,
        scope: "one",
      })
    ).toThrow();
  });

  it("requires exactly one anticipation selector and defaults to preview", () => {
    const seriesId = "f07902b7-2280-4aaf-a35b-0fe981262928";

    const byCount = anticipateInstallmentsInputSchema.parse({
      idempotencyKey: "anticipate-2026-07-26-001",
      seriesId,
      anticipationPeriod: "2026-07",
      count: 3,
    });
    expect(byCount.mode).toBe("preview");

    // Zero selectors is rejected.
    expect(() =>
      anticipateInstallmentsInputSchema.parse({
        idempotencyKey: "anticipate-2026-07-26-002",
        seriesId,
        anticipationPeriod: "2026-07",
      })
    ).toThrow();

    // Two selectors at once is rejected.
    expect(() =>
      anticipateInstallmentsInputSchema.parse({
        idempotencyKey: "anticipate-2026-07-26-003",
        seriesId,
        anticipationPeriod: "2026-07",
        count: 2,
        throughPeriod: "2026-10",
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
