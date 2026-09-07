import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import {
  assertFullWrites,
  assertSafeWrites,
  resolveMcpPrincipal,
  resolveWriteMode,
  type McpPrincipal,
} from "@/lib/finance/mcp/config";
import {
  getAccountStatement,
  getCategoryReport,
  getFinanceOverview,
  getInvoice,
  getTransaction,
  getUpcomingObligations,
  listAccounts,
  listBudgets,
  listCards,
  listTransactions,
  lookupEntities,
} from "@/lib/finance/mcp/read-service";
import {
  accountStatementInputSchema,
  anticipateInstallmentsInputSchema,
  budgetsInputSchema,
  categoryReportInputSchema,
  createTransactionInputSchema,
  deleteSeriesInputSchema,
  deleteTransactionInputSchema,
  entityIdInputSchema,
  importApplyInputSchema,
  importPreviewInputSchema,
  invoiceInputSchema,
  payInvoiceInputSchema,
  reverseInvoicePaymentInputSchema,
  reverseTransferInputSchema,
  listTransactionsInputSchema,
  lookupInputSchema,
  overviewInputSchema,
  settleTransactionInputSchema,
  transferInputSchema,
  upcomingInputSchema,
  updateSeriesInputSchema,
  updateTransactionInputSchema,
  upsertBudgetInputSchema,
} from "@/lib/finance/mcp/schemas";
import {
  anticipateInstallments,
  createTransaction,
  deleteSeries,
  deleteTransaction,
  importApply,
  importPreview,
  payInvoice,
  reverseInvoicePayment,
  reverseTransfer,
  setTransactionSettled,
  transferBetweenAccounts,
  updateSeries,
  updateTransaction,
  upsertBudget,
} from "@/lib/finance/mcp/write-service";
import { getCurrentPeriod } from "@/lib/utils/period";
import { z } from "zod";

export async function createMcpServer() {
dotenv.config({ quiet: true });

let _principal: McpPrincipal | undefined;
async function getPrincipal(): Promise<McpPrincipal> {
  if (!_principal) _principal = await resolveMcpPrincipal();
  return _principal;
}

const writeMode = resolveWriteMode(process.env.OPENSHEETS_MCP_WRITE_MODE);

const server = new McpServer(
  {
    name: "opensheets-finance",
    version: "0.1.0",
    websiteUrl: "https://github.com/felipegcoutinho/opensheets-app",
  },
  {
    instructions: [
      "Use these tools only for the configured Opensheets user.",
      "Amounts are BRL numbers. Transaction results include signed amount and absoluteAmount.",
      "Resolve human names with finance_lookup_entities before passing IDs.",
      "Never infer that a pending item was paid.",
      "Before a write, summarize the exact financial change for the user.",
      `Write mode is ${writeMode}.`,
    ].join(" "),
  }
);

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toolSuccess(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function toolError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected MCP tool error.";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

server.registerTool(
  "finance_overview",
  {
    title: "Monthly financial overview",
    description:
      "Return income, expenses, net result, savings rate, account balances, budgets, and pending totals for one YYYY-MM period.",
    inputSchema: overviewInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const input = overviewInputSchema.parse(args);
      return toolSuccess(
        asRecord(await getFinanceOverview((await getPrincipal()).userId, input.period))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_list_transactions",
  {
    title: "List financial transactions",
    description:
      "Search bounded, paginated transactions. Use this for detailed spending, income, settlement, category, payer, account, or card questions.",
    inputSchema: listTransactionsInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      return toolSuccess(
        asRecord(
          await listTransactions(
            (await getPrincipal()).userId,
            listTransactionsInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_get_transaction",
  {
    title: "Get transaction details",
    description:
      "Return one transaction with account, card, category, payer, installment, recurrence, transfer, and series context.",
    inputSchema: entityIdInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const { id } = entityIdInputSchema.parse(args);
      return toolSuccess(
        asRecord(await getTransaction((await getPrincipal()).userId, id))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_list_accounts",
  {
    title: "List accounts and balances",
    description:
      "Return every configured financial account with its calculated settled balance.",
    inputSchema: {},
    annotations: readAnnotations,
  },
  async () => {
    try {
      return toolSuccess({
        accounts: await listAccounts((await getPrincipal()).userId),
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_get_account_statement",
  {
    title: "Get account statement",
    description:
      "Return an account's balance information and up to 100 transactions for one period.",
    inputSchema: accountStatementInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const input = accountStatementInputSchema.parse(args);
      return toolSuccess(
        asRecord(
          await getAccountStatement(
            (await getPrincipal()).userId,
            input.accountId,
            input.period
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_list_cards",
  {
    title: "List cards and credit exposure",
    description:
      "Return cards, limits, current unsettled usage, available limits, and linked accounts.",
    inputSchema: {},
    annotations: readAnnotations,
  },
  async () => {
    try {
      return toolSuccess({ cards: await listCards((await getPrincipal()).userId) });
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_get_invoice",
  {
    title: "Get credit-card invoice",
    description:
      "Return invoice payment status, total, card details, and up to 100 transactions for a card and period.",
    inputSchema: invoiceInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const input = invoiceInputSchema.parse(args);
      return toolSuccess(
        asRecord(
          await getInvoice((await getPrincipal()).userId, input.cardId, input.period)
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_list_budgets",
  {
    title: "List monthly budgets",
    description:
      "Return each category budget with spent, remaining, and utilization values.",
    inputSchema: budgetsInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const { period } = budgetsInputSchema.parse(args);
      return toolSuccess({
        period,
        budgets: await listBudgets((await getPrincipal()).userId, period),
      });
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_category_report",
  {
    title: "Category report",
    description:
      "Compare category totals and month-over-month changes for a range of at most 36 months.",
    inputSchema: categoryReportInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      return toolSuccess(
        asRecord(
          await getCategoryReport(
            (await getPrincipal()).userId,
            categoryReportInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_lookup_entities",
  {
    title: "Resolve finance entity names",
    description:
      "Find account, card, category, and payer IDs by human-readable name. Call this before write tools that require IDs.",
    inputSchema: lookupInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      return toolSuccess(
        await lookupEntities(
          (await getPrincipal()).userId,
          lookupInputSchema.parse(args)
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_upcoming_obligations",
  {
    title: "Upcoming financial obligations",
    description:
      "Return up to 200 unsettled transactions due or scheduled in a bounded future window.",
    inputSchema: upcomingInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const input = upcomingInputSchema.parse(args);
      return toolSuccess(
        asRecord(
          await getUpcomingObligations(
            (await getPrincipal()).userId,
            input.from,
            input.days
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_create_transaction",
  {
    title: "Create a transaction",
    description:
      "Create one non-series income or expense transaction. Does not send payer email. Requires safe-writes mode and a stable idempotency key.",
    inputSchema: createTransactionInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      assertSafeWrites(await getPrincipal());
      return toolSuccess(
        asRecord(
          await createTransaction(
            (await getPrincipal()).userId,
            createTransactionInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_update_transaction",
  {
    title: "Update a transaction",
    description:
      "Replace one simple transaction. Rejects protected, transfer, recurring, and installment records. Requires safe-writes mode and idempotency.",
    inputSchema: updateTransactionInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      assertSafeWrites(await getPrincipal());
      return toolSuccess(
        asRecord(
          await updateTransaction(
            (await getPrincipal()).userId,
            updateTransactionInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_set_transaction_settled",
  {
    title: "Set transaction settlement",
    description:
      "Mark a non-card transaction paid or unpaid. Card transactions must be reconciled through invoices.",
    inputSchema: settleTransactionInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      assertSafeWrites(await getPrincipal());
      return toolSuccess(
        asRecord(
          await setTransactionSettled(
            (await getPrincipal()).userId,
            settleTransactionInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_transfer_between_accounts",
  {
    title: "Transfer between accounts",
    description:
      "Atomically create the linked outgoing and incoming sides of an internal account transfer.",
    inputSchema: transferInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      assertSafeWrites(await getPrincipal());
      return toolSuccess(
        asRecord(
          await transferBetweenAccounts(
            (await getPrincipal()).userId,
            transferInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_upsert_budget",
  {
    title: "Create or update a budget",
    description:
      "Create or update the monthly budget for one owned expense category.",
    inputSchema: upsertBudgetInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      assertSafeWrites(await getPrincipal());
      return toolSuccess(
        asRecord(
          await upsertBudget(
            (await getPrincipal()).userId,
            upsertBudgetInputSchema.parse(args)
          )
        )
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_delete_transaction",
  {
    title: "Delete a transaction",
    description:
      "Permanently delete one simple transaction. Rejects protected, transfer, series, and anticipated records. Requires full write mode. Call with mode='preview' to see the impact, then mode='apply' with the same idempotency key to delete.",
    inputSchema: deleteTransactionInputSchema.shape,
    annotations: destructiveAnnotations,
  },
  async (args) => {
    try {
      const parsed = deleteTransactionInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await deleteTransaction((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_reverse_transfer",
  {
    title: "Reverse a transfer",
    description:
      "Atomically delete both legs of an internal account transfer. Requires full write mode. Call with mode='preview' to see both legs, then mode='apply' with the same idempotency key to reverse.",
    inputSchema: reverseTransferInputSchema.shape,
    annotations: destructiveAnnotations,
  },
  async (args) => {
    try {
      const parsed = reverseTransferInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await reverseTransfer((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_pay_invoice",
  {
    title: "Pay a credit-card invoice",
    description:
      "Mark a card invoice paid for one period: settle its transactions and record the admin payment lançamento. Requires full write mode. Call with mode='preview' to see the impact, then mode='apply' with the same idempotency key to pay.",
    inputSchema: payInvoiceInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      const parsed = payInvoiceInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await payInvoice((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_reverse_invoice_payment",
  {
    title: "Reverse a credit-card invoice payment",
    description:
      "Undo an invoice payment for one period: mark its transactions unsettled and delete the admin payment lançamento. Requires full write mode. Call with mode='preview' to see the impact, then mode='apply' with the same idempotency key to reverse.",
    inputSchema: reverseInvoicePaymentInputSchema.shape,
    annotations: destructiveAnnotations,
  },
  async (args) => {
    try {
      const parsed = reverseInvoicePaymentInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await reverseInvoicePayment((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_update_series",
  {
    title: "Edit a recurring/installment series",
    description:
      "Bulk-edit the rows of a recurring or installment series relative to an anchor transaction (scope='current' | 'future' | 'all'). Only the fields you pass change; due dates shift by each row's month offset from the anchor. Requires full write mode. Call with mode='preview' to see the affected rows, then mode='apply' with the same idempotency key to edit.",
    inputSchema: updateSeriesInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      const parsed = updateSeriesInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await updateSeries((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_delete_series",
  {
    title: "Delete a recurring/installment series",
    description:
      "Bulk-delete the rows of a recurring or installment series relative to an anchor transaction (scope='current' | 'future' | 'all'). Requires full write mode. Call with mode='preview' to see the affected rows, then mode='apply' with the same idempotency key to delete.",
    inputSchema: deleteSeriesInputSchema.shape,
    annotations: destructiveAnnotations,
  },
  async (args) => {
    try {
      const parsed = deleteSeriesInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await deleteSeries((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_anticipate_installments",
  {
    title: "Anticipate installments",
    description:
      "Anticipate future installments of a series into a single consolidated lançamento for one period, optionally applying a discount. Select the installments with exactly one of installmentIds, count (the next N eligible), or throughPeriod (all eligible up to that period). Requires full write mode. Call with mode='preview' to see the discount/total/final breakdown and affected installments, then mode='apply' with the same idempotency key to anticipate.",
    inputSchema: anticipateInstallmentsInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      const parsed = anticipateInstallmentsInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await anticipateInstallments((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_import_preview",
  {
    title: "Preview an OFX/CSV import",
    description:
      "Parse an OFX or CSV file for one bank account or credit card, dedup against existing lançamentos, and suggest categories from history. Returns candidate rows and a previewToken to pass to finance_import_apply. Pass exactly one of filePath (must be under OPENSHEETS_MCP_IMPORT_DIR) or base64 content. Read-only — no writes and no audit record.",
    inputSchema: importPreviewInputSchema.shape,
    annotations: readAnnotations,
  },
  async (args) => {
    try {
      const parsed = importPreviewInputSchema.parse(args);
      return toolSuccess(
        asRecord(await importPreview((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

server.registerTool(
  "finance_import_apply",
  {
    title: "Apply a previewed OFX/CSV import",
    description:
      "Insert the accepted rows from a prior finance_import_preview. Provide the previewToken and the acceptedRowIds you want imported; duplicates are re-checked at insert time. Requires full write mode. Call with mode='preview' first to confirm the affected rows, then mode='apply' with the same idempotency key.",
    inputSchema: importApplyInputSchema.shape,
    annotations: writeAnnotations,
  },
  async (args) => {
    try {
      const parsed = importApplyInputSchema.parse(args);
      if (parsed.mode === "apply") assertFullWrites(await getPrincipal());
      return toolSuccess(
        asRecord(await importApply((await getPrincipal()).userId, parsed))
      );
    } catch (error) {
      return toolError(error);
    }
  }
);

const rules = {
  currency: "BRL",
  periodFormat: "YYYY-MM",
  dateFormat: "YYYY-MM-DD",
  amountSemantics:
    "Expenses are stored as negative amounts, income as positive amounts, and transfers as a linked negative/positive pair.",
  cardSettlement:
    "Credit-card purchases use null settlement until their invoice is reconciled.",
  safety:
    "The MCP safe-write surface does not delete records, edit series, import files, anticipate installments, or send payer email. High-risk tools (deletion, transfer reversal, invoice payment and reversal, series edit and delete, installment anticipation, OFX/CSV import apply) require full write mode and a preview/apply confirmation; preview never mutates. finance_import_preview itself is read-only but its previewToken is required to apply.",
};

server.registerResource(
  "transaction-semantics",
  "finance://rules/transaction-semantics",
  {
    title: "Opensheets transaction semantics",
    description: "Canonical calculation and safety rules for finance tools.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      { uri: uri.href, mimeType: "application/json", text: JSON.stringify(rules) },
    ],
  })
);

for (const resource of [
  {
    name: "accounts-catalog",
    uri: "finance://catalog/accounts",
    load: async () => listAccounts((await getPrincipal()).userId),
  },
  {
    name: "cards-catalog",
    uri: "finance://catalog/cards",
    load: async () => listCards((await getPrincipal()).userId),
  },
]) {
  server.registerResource(
    resource.name,
    resource.uri,
    {
      title: resource.name,
      description: `Current ${resource.name.replace("-catalog", "")} catalog`,
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await resource.load()),
        },
      ],
    })
  );
}

for (const resource of [
  { name: "categories-catalog", type: "category" as const },
  { name: "payers-catalog", type: "payer" as const },
] as const) {
  const uriValue = `finance://catalog/${
    resource.type === "category" ? "categories" : "payers"
  }`;
  server.registerResource(
    resource.name,
    uriValue,
    {
      title: resource.name,
      description: `Current ${resource.type} catalog`,
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await lookupEntities((await getPrincipal()).userId, {
              query: "",
              entityTypes: [resource.type],
              limit: 50,
            })
          ),
        },
      ],
    })
  );
}

server.registerPrompt(
  "monthly-financial-review",
  {
    title: "Monthly financial review",
    description:
      "Review one month using overview, budgets, obligations, and category evidence.",
    argsSchema: {
      period: z.string().default(getCurrentPeriod()),
    },
  },
  async ({ period }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review my finances for ${period}. Use finance_overview, finance_list_budgets, finance_category_report, and finance_upcoming_obligations. Separate facts from estimates, cite the figures returned by tools, identify the three most important issues, and propose a short action plan. Do not mutate data.`,
        },
      },
    ],
  })
);

return server;
}

async function main() {
  const server = await createMcpServer();
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(
    "[opensheets-mcp] Startup failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
