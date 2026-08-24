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

---

## Later-release implementation plans

This section turns the deferred items above into concrete, ordered work. It also
records one correctness gap in the shipped surface (`full` write mode) that must
be closed before any high-risk tool is exposed.

**Status:** Shared building blocks (`full`-mode gate + preview/apply protocol)
and features 1–6 (deletion, transfer reversal, invoice payment/reversal, series
edit/delete, installment anticipation, OFX/CSV import preview + apply) are
implemented. Features 3–5 single-source their logic through
`lib/finance/invoice-payment-service.ts`, `lib/finance/series-service.ts`, and
`lib/finance/anticipation-service.ts`, which the dashboard actions
(`updateInvoicePaymentStatusAction`, `updateLancamentoBulkAction`,
`deleteLancamentoBulkAction`, `createInstallmentAnticipationAction`) also call.
Feature 6 ships a shared `lib/finance/import-service.ts`
(`parseImportSource` + `enrichCandidates` + `applyImportCandidates`) that the
MCP tools call directly; a follow-up will migrate the dashboard's
`importOfxTransactionsAction` and `importCsvTransactionsAction` onto the same
service to close their orchestration drift. Feature 7 ships a Claude Desktop
`.mcpb` bundle: `mcp/mcpb/manifest.json` + `scripts/mcp/pack.ts` (`pnpm mcp:pack`)
stage the compiled `dist/mcp/server.js` with a minimal `package.json` covering
the four externalised runtime deps and zip everything into
`dist/mcpb/opensheets-finance-<version>.mcpb`. Remaining: feature 8.

### Shared building blocks (do first)

These are prerequisites reused by most high-risk tools below. Building them once
keeps every feature consistent and testable.

1. **Fix `full` write mode gating.** Today `full` is accepted but behaves exactly
   like `safe-writes`, and every write tool only calls `assertSafeWrites`. Before
   any high-risk tool ships, add a second gate so risky tools are unreachable in
   `safe-writes`.
   - `lib/finance/mcp/config.ts`: add `assertFullWrites(principal)` that rejects
     unless `writeMode === "full"` (readonly and safe-writes both blocked).
   - Keep `assertSafeWrites` for the existing five tools; high-risk tools call
     `assertFullWrites`.
   - Update `docs/MCP_SETUP.md`: `full` is no longer "equivalent to safe-writes";
     document exactly which tools each mode unlocks.
   - Add a `writeMode` matrix test in `config.test.ts`.

2. **Preview/apply protocol.** High-risk mutations (delete, reverse, pay invoice,
   edit series, anticipate, import) must be two-step and never mutate on the
   preview call.
   - Add a shared `mode: z.enum(["preview", "apply"]).default("preview")` field to
     the relevant input schemas, plus the existing `idempotencyKey`.
   - `preview` returns a structured, read-only impact summary (records touched,
     signed deltas, resulting balances/invoice status) and performs no writes; it
     bypasses `runAuditedMutation`.
   - `apply` runs inside `runAuditedMutation` (idempotency + audit) and, for
     multi-row effects, inside a single `db.transaction`.
   - The audit `arguments` redaction (`redactArguments`) already strips
     `name/note/amount`; extend the sensitive-key set only if new tools add
     free-text/value fields.

3. **Soft-delete decision.** The schema has no soft-delete column. Decide per the
   plan's "does not yet have soft deletion" finding:
   - Option A (recommended, smaller): hard-delete inside a transaction and rely on
     the audit log's stored `result` snapshot for traceability. Record the full
     pre-delete row in the audit `result` so the action is reconstructable.
   - Option B: add `deleted_at` to `lancamentos` + a follow-up migration and teach
     every read query to filter it. Larger blast radius; defer unless required.
   - This plan assumes Option A.

### 1. Preview/apply deletion (`finance_delete_transaction`)

- **Schema** (`schemas.ts`): `{ idempotencyKey, transactionId, mode }`.
- **Service** (`write-service.ts`): load the owned row; reject the same protected
  set already guarded in `updateTransaction`/`setTransactionSettled` (initial
  balance, `PROTECTED_CATEGORIES`). Reject `seriesId`/`transferId` rows — those
  are deleted by the series/reversal tools below, not here.
  - `preview`: return `{ willDelete: {...row}, linkedRecords: [] }`.
  - `apply`: capture the row into the audit `result`, then delete; return
    `{ transactionId, deleted: true }`.
- **Gate**: `assertFullWrites`.
- **Annotations**: `destructiveHint: true`, `idempotentHint: true`.
- **Tests**: cross-user isolation (cannot delete another user's row), protected
  rejection, idempotent replay, series/transfer rejection.

### 2. Transfer reversal (`finance_reverse_transfer`)

- **Schema**: `{ idempotencyKey, transferId, mode }`.
- **Service**: load both sides by `transferId` scoped to the user; assert exactly
  two linked rows exist.
  - `preview`: show both legs and the net effect on each account.
  - `apply`: delete both legs atomically in one `db.transaction` (mirror the
    creation logic in `transferBetweenAccounts`); fail closed if either side is
    missing.
- **Gate**: `assertFullWrites`. **Annotations**: `destructiveHint: true`.
- **Tests**: both-or-neither deletion, cross-user isolation, idempotent replay.

### 3. Invoice payment + reversal (`finance_pay_invoice`, `finance_reverse_invoice_payment`)

The app already implements this in
`app/(dashboard)/cartoes/[cartaoId]/fatura/actions.ts::updateInvoicePaymentStatusAction`.
Port that logic behind the MCP boundary rather than re-deriving it.

- **Schema**: `{ idempotencyKey, cardId, period, mode, paymentDate? }`.
- **Service** (new `invoice-write-service.ts` or extend `write-service.ts`):
  replicate the existing transaction: upsert the `faturas` row to `Pago`, mark the
  card's period `lancamentos` `isSettled = true`, compute the admin share, and
  create the linked `Pagamentos` debit on `card.contaId`. Reuse `INVOICE_*`
  constants from `lib/faturas.ts`.
  - `preview`: return invoice total, admin share, target account, and the debit
    that would be created (reuse `getInvoice` for the current state).
  - `apply`: run the whole port inside one `db.transaction` under
    `runAuditedMutation`.
  - Reversal mirrors it: set `faturas` back to `Pendente`, unsettle the card rows,
    and delete the generated `Pagamentos` debit (match it via the audit `result`
    or the transfer/series linkage used at creation).
- **Gate**: `assertFullWrites`. **Annotations**: pay is non-destructive but
  balance-affecting; reversal is `destructiveHint: true`.
- **Tests**: admin-share math parity with the server action, no double-pay on
  replay, reversal restores prior state, cross-user isolation.
- **Risk note**: keep the MCP port and the server action reading the same helper
  so they cannot drift. Prefer extracting a shared `payInvoice(tx, ...)` helper
  the server action also calls.

### 4. Recurring / installment series editing (`finance_update_series`, `finance_delete_series`)

- **Schema**: `{ idempotencyKey, seriesId, scope: "one" | "future" | "all", mode, ...fields }`.
- **Service**: load all owned rows sharing `seriesId`; apply `scope` to select
  which rows change. Reuse `lib/installments` helpers where they exist.
  - `preview`: enumerate affected rows and per-row deltas.
  - `apply`: transactional bulk update/delete; recompute `period`/signed amounts
    with the same helpers as single-row writes.
- **Gate**: `assertFullWrites`. **Annotations**: update non-destructive; delete
  destructive. Both `idempotentHint: true`.
- **Tests**: scope selection correctness, partial-failure rollback, isolation.

### 5. Installment anticipation (`finance_anticipate_installments`)

- Build on `lib/installments/anticipation-helpers.ts` and
  `anticipation-types.ts` so MCP and app share one calculation path.
- **Schema**: `{ idempotencyKey, seriesId, installmentsToAnticipate | throughDate, mode }`.
- **Service**: `preview` returns the discount/interest breakdown the helper
  computes and the resulting rows; `apply` writes them transactionally.
- **Gate**: `assertFullWrites`. **Tests**: figure parity with the helper, replay
  safety, isolation.

### 6. OFX/CSV import review and confirmation (`finance_import_preview`, `finance_import_apply`)

- Reuse `lib/ofx` (`parser`, `mapper`, `duplicate-detector`, `category-suggester`)
  and `lib/csv` (`parser`, `mapper`) — do not re-parse in MCP.
- **Transport concern**: file bytes must reach the server. For stdio, accept a
  server-readable `filePath` (validated to an allowlisted directory) or a base64
  `content` field bounded by size; never a URL.
- **Schema**: `finance_import_preview { source: "ofx"|"csv", filePath|content, accountId|cardId }`
  → returns parsed + de-duplicated candidate rows with suggested categories and a
  `previewToken` (hash of the candidate set stored in the audit log).
  `finance_import_apply { idempotencyKey, previewToken, acceptedRowIds[] }` inserts
  only confirmed rows transactionally, re-checking duplicates at apply time.
- **Gate**: `assertFullWrites`. **Annotations**: non-destructive but bulk-writing.
- **Tests**: duplicate suppression, partial acceptance, `previewToken` mismatch
  rejection, isolation, size bounds.

### 7. Packaged Claude Desktop `.mcpb` extension

- Add an `mcpb`/`dxt` manifest declaring the bundled `dist/mcp/server.js` entry,
  required env (`DATABASE_URL`, one of the user identifiers, `OPENSHEETS_MCP_WRITE_MODE`),
  and user-facing config prompts.
- Add a `pnpm mcp:pack` script that builds then packs; document install in
  `docs/MCP_SETUP.md`. No runtime code changes.

### 8. Streamable HTTP + OAuth (remote multi-user)

Largest item; keep last. It breaks the current single-configured-user assumption.

- Swap `StdioServerTransport` for the SDK's Streamable HTTP transport behind the
  Next.js app (or a small standalone server).
- Replace env-based identity with a per-request OAuth-authenticated principal;
  `resolveMcpPrincipal` becomes request-scoped, deriving `userId` from the token
  instead of env. Every service call already takes `userId`, so the service layer
  needs no change — only the principal source and transport do.
- Add token validation, per-user rate limiting, and CORS/origin checks.
- Reuse the same audit + idempotency layer.
- **Tests**: two authenticated users cannot see each other's data; missing/invalid
  token rejected; write-mode still enforced per principal.

### Suggested delivery order

1. Shared building blocks (`full`-mode gate + preview/apply protocol).
2. Deletion + transfer reversal (smallest, exercise the protocol end to end).
3. Invoice payment/reversal (highest user value; port existing logic).
4. Series editing + installment anticipation (share installment helpers).
5. OFX/CSV import (needs the file-transport decision).
6. `.mcpb` packaging.
7. Streamable HTTP + OAuth.

### Cross-cutting acceptance criteria

- No high-risk tool is reachable in `readonly` or `safe-writes` mode.
- Every `preview` call performs zero writes and is safe to repeat.
- Every `apply` call is idempotent, audited, and atomic across all rows it
  touches.
- Ported logic (invoice payment, anticipation) produces figures identical to the
  existing app path, enforced by parity tests.
- No call reads or writes another user's records.
