import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import {
  assertSafeWrites,
  resolveMcpPrincipal,
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
  budgetsInputSchema,
  categoryReportInputSchema,
  createTransactionInputSchema,
  entityIdInputSchema,
  invoiceInputSchema,
  listTransactionsInputSchema,
  lookupInputSchema,
  overviewInputSchema,
  settleTransactionInputSchema,
  transferInputSchema,
  upcomingInputSchema,
  updateTransactionInputSchema,
  upsertBudgetInputSchema,
} from "@/lib/finance/mcp/schemas";
import {
  createTransaction,
  setTransactionSettled,
  transferBetweenAccounts,
  updateTransaction,
  upsertBudget,
} from "@/lib/finance/mcp/write-service";
import { getCurrentPeriod } from "@/lib/utils/period";
import { z } from "zod";

async function main() {
dotenv.config({ quiet: true });
const principal = await resolveMcpPrincipal();

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
      `Write mode is ${principal.writeMode}.`,
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
        asRecord(await getFinanceOverview(principal.userId, input.period))
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
            principal.userId,
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
        asRecord(await getTransaction(principal.userId, id))
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
        accounts: await listAccounts(principal.userId),
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
            principal.userId,
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
      return toolSuccess({ cards: await listCards(principal.userId) });
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
          await getInvoice(principal.userId, input.cardId, input.period)
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
        budgets: await listBudgets(principal.userId, period),
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
            principal.userId,
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
          principal.userId,
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
            principal.userId,
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
      assertSafeWrites(principal);
      return toolSuccess(
        asRecord(
          await createTransaction(
            principal.userId,
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
      assertSafeWrites(principal);
      return toolSuccess(
        asRecord(
          await updateTransaction(
            principal.userId,
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
      assertSafeWrites(principal);
      return toolSuccess(
        asRecord(
          await setTransactionSettled(
            principal.userId,
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
      assertSafeWrites(principal);
      return toolSuccess(
        asRecord(
          await transferBetweenAccounts(
            principal.userId,
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
      assertSafeWrites(principal);
      return toolSuccess(
        asRecord(
          await upsertBudget(
            principal.userId,
            upsertBudgetInputSchema.parse(args)
          )
        )
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
    "The MCP safe-write surface does not delete records, edit series, pay invoices, import files, anticipate installments, or send payer email.",
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
    load: () => listAccounts(principal.userId),
  },
  {
    name: "cards-catalog",
    uri: "finance://catalog/cards",
    load: () => listCards(principal.userId),
  },
] as const) {
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
            await lookupEntities(principal.userId, {
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

const transport = new StdioServerTransport();
await server.connect(transport);
}

main().catch((error) => {
  console.error(
    "[opensheets-mcp] Startup failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
