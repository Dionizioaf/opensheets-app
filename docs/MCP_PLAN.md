# Opensheets MCP implementation plan

## Goal

Create a local Model Context Protocol server that lets Claude inspect and manage
one Opensheets user's personal-finance data without exposing PostgreSQL or the
Next.js application publicly.

The first supported transport is `stdio`. Claude launches the server as a local
child process, and the server connects to the same PostgreSQL database used by
Opensheets.

## Architecture

```text
Claude Desktop / Claude Code
              |
              | MCP over stdio
              v
       Opensheets MCP server
              |
              v
      Finance service modules
              |
              v
       Drizzle / PostgreSQL
```

Finance services receive a trusted `userId`; tool arguments never choose the
user. Every query and mutation must include that user boundary.

## Existing project findings

- Finance data is stored in PostgreSQL through Drizzle.
- Transactions are the central record and contain signed amounts, periods,
  settlement state, account/card references, categories, payers, recurring or
  installment series, splits, transfers, and installment anticipations.
- The application does not have a finance API. Mutations currently live in
  authenticated Next.js server actions.
- Next.js authentication helpers depend on request headers and redirects and
  therefore cannot authenticate a local MCP process.
- Some mutations can send payer email, revalidate Next.js pages, or create
  multiple linked records. MCP operations must make those effects explicit.
- The repository does not yet have mutation auditing, idempotency, or soft
  deletion.
- Goals, debts, emergency reserves, cash-flow forecasting, and annual planning
  are described as future product ideas but do not yet exist in the schema.

## MCP capabilities

### Read tools

- `finance_overview`
- `finance_list_transactions`
- `finance_get_transaction`
- `finance_list_accounts`
- `finance_get_account_statement`
- `finance_list_cards`
- `finance_get_invoice`
- `finance_list_budgets`
- `finance_category_report`
- `finance_lookup_entities`
- `finance_upcoming_obligations`

### Guarded write tools

- `finance_create_transaction`
- `finance_update_transaction`
- `finance_set_transaction_settled`
- `finance_transfer_between_accounts`
- `finance_upsert_budget`

Deletion, bulk mutation, imports, invoice reversals, and installment anticipation
are intentionally deferred until they have preview/apply flows and broader
integration coverage.

### Resources

- `finance://catalog/accounts`
- `finance://catalog/cards`
- `finance://catalog/categories`
- `finance://catalog/payers`
- `finance://rules/transaction-semantics`

## Identity and configuration

The server requires:

- `DATABASE_URL`
- exactly one of `OPENSHEETS_MCP_USER_ID` or `OPENSHEETS_MCP_USER_EMAIL`

It verifies the configured user at startup and never accepts a user identifier
from Claude.

`OPENSHEETS_MCP_WRITE_MODE` controls mutations:

- `readonly` (default): reject every mutation
- `safe-writes`: allow the daily-write tools listed above
- `full`: reserved for future high-risk tools

## Safety requirements

- Validate every input with Zod.
- Scope every database operation to the configured user.
- Validate ownership of referenced accounts, cards, categories, and payers.
- Keep account and card references mutually exclusive.
- Derive the transaction sign from the transaction type.
- Keep transfers atomic and create both linked sides.
- Preserve credit-card settlement semantics.
- Require an idempotency key for mutations.
- Store a redacted audit record for every attempted mutation.
- Do not send payer email from MCP tools.
- Send protocol messages only to stdout; operational logs use stderr.
- Bound page size and date/period ranges.
- Mark tools with MCP read-only/destructive/idempotent annotations.

## Delivery phases

1. Save this plan and establish a clean dependency/test baseline.
2. Add reusable MCP finance services and validation schemas.
3. Implement the bundled TypeScript stdio server, tools, and resources.
4. Add the audit table and migration.
5. Add service, isolation, idempotency, and MCP contract tests.
6. Document Claude Code and Claude Desktop configuration.
7. Run type checking, tests, lint, production build, and an MCP protocol smoke
   test.

## Acceptance criteria

- Claude can answer monthly overview, category, transaction, account, card,
  invoice, budget, and upcoming-obligation questions.
- No call can read or write another user's records.
- Read-only mode deterministically rejects mutations.
- Repeating a mutation with the same idempotency key does not duplicate data.
- Transfers either create both sides or neither side.
- Tool results are structured, bounded, and use consistent BRL/date semantics.
- The compiled server starts using `node dist/mcp/server.js`.
- Claude Code can list and invoke the tools through a local `stdio`
  configuration.

## Later releases

- Preview/apply deletion and reversal workflows.
- Invoice payment and reversal tools.
- Recurring/installment series editing.
- OFX/CSV import review and confirmation.
- Installment anticipation.
- A packaged Claude Desktop `.mcpb` extension.
- Streamable HTTP plus OAuth for remote multi-user use.
