# Opensheets finance MCP tool guide

Use this file only when routing an Opensheet request or checking the safety
level of an operation.

## Read tools

| Need | Tool |
| --- | --- |
| Monthly income, expenses, savings, balances, budgets, and pending totals | `finance_overview` |
| Search or paginate transactions | `finance_list_transactions` |
| Full context for one transaction | `finance_get_transaction` |
| Account balances | `finance_list_accounts` |
| One account's monthly statement | `finance_get_account_statement` |
| Card limits and current exposure | `finance_list_cards` |
| One card invoice for a period | `finance_get_invoice` |
| Monthly category budgets | `finance_list_budgets` |
| Category trends across up to 36 months | `finance_category_report` |
| Resolve account, card, category, or payer names to IDs | `finance_lookup_entities` |
| Unsettled items due in a future window | `finance_upcoming_obligations` |
| Parse and deduplicate an OFX/CSV before import | `finance_import_preview` |

## Safe writes

These require `OPENSHEETS_MCP_WRITE_MODE=safe-writes` or `full` and a stable
idempotency key:

- `finance_create_transaction`: one simple, non-series income or expense.
- `finance_update_transaction`: replace a simple, unprotected transaction.
- `finance_set_transaction_settled`: settle or unsettle a non-card record.
- `finance_transfer_between_accounts`: atomically create both transfer legs.
- `finance_upsert_budget`: create or update one monthly category budget.

Resolve names before writes. Safe-write tools reject protected, transfer,
recurring, or installment records where applicable and never send payer email.

## High-risk writes

These require `OPENSHEETS_MCP_WRITE_MODE=full`. Always run `mode="preview"`,
show the impact, wait for explicit confirmation, and then run `mode="apply"`
with the same idempotency key:

- `finance_delete_transaction`
- `finance_reverse_transfer`
- `finance_pay_invoice`
- `finance_reverse_invoice_payment`
- `finance_update_series`
- `finance_delete_series`
- `finance_anticipate_installments`
- `finance_import_apply`

For imports, call `finance_import_preview` first. Pass its `previewToken` and
only the user-accepted row IDs to `finance_import_apply`; duplicates are checked
again during apply. File paths must be inside `OPENSHEETS_MCP_IMPORT_DIR`, unless
the content is supplied as base64.

## Failure handling

- `readonly` rejection: report that writes are disabled; do not edit config.
- Ownership or protected-record rejection: explain the boundary and stop.
- Ambiguous lookup: show the minimal distinguishing fields and ask the user.
- Retriable transport failure: reconnect and retry only with the original
  idempotency key.
- Unknown mutation outcome: read the affected data or retry idempotently before
  reporting whether it succeeded.
