# Using Opensheets with Claude through MCP

The Opensheets MCP server is local and uses the same PostgreSQL database as the
web application. It communicates with Claude over `stdio`; it does not open a
network port.

## 1. Prepare the project

```bash
pnpm install
pnpm db:migrate
pnpm mcp:build
```

The MCP audit migration creates `mcp_audit_logs`. It does not modify existing
financial records.

## 2. Select the Opensheets user

Find the user ID in the `user` table, or configure the exact login email. Set
exactly one:

```env
OPENSHEETS_MCP_USER_ID=the-user-id
# OPENSHEETS_MCP_USER_EMAIL=user@example.com
```

The server verifies the identity on startup. Claude cannot pass or change the
user ID in a tool call.

## 3. Select a write mode

```env
OPENSHEETS_MCP_WRITE_MODE=readonly
```

Available modes:

- `readonly`: default; every mutation is rejected.
- `safe-writes`: enables the guarded daily-write tools — simple transaction
  creation/update/settlement, transfers, and budget upserts.
- `full`: everything `safe-writes` allows, plus high-risk tools (deletion,
  reversal, invoice payment, series editing, anticipation, import). High-risk
  tools are gated separately and remain rejected under `safe-writes`.

Start with `readonly`. Switch to `safe-writes` only after confirming that
Claude is connected to the intended database and user.

## 4. Claude Code

From the repository, build the server and add a local-scoped configuration:

```bash
claude mcp add --transport stdio --scope local \
  --env DATABASE_URL="$DATABASE_URL" \
  --env OPENSHEETS_MCP_USER_ID="$OPENSHEETS_MCP_USER_ID" \
  --env OPENSHEETS_MCP_WRITE_MODE=readonly \
  opensheets-finance -- node "$PWD/dist/mcp/server.js"
```

Then verify it:

```bash
claude mcp get opensheets-finance
claude mcp list
```

Inside Claude Code, use `/mcp` to inspect connection status and available
tools.

For a shared project configuration, copy `.mcp.json.example` to `.mcp.json`.
Do not commit database credentials or a personal user ID.

## 5. Claude Desktop

Claude Desktop can launch the same compiled server. Add a local server whose
command is `node`, whose argument is the absolute path to
`dist/mcp/server.js`, and whose environment contains:

- `DATABASE_URL`
- `OPENSHEETS_MCP_USER_ID` or `OPENSHEETS_MCP_USER_EMAIL`
- `OPENSHEETS_MCP_WRITE_MODE`

Use absolute paths because desktop applications may not inherit the same shell
`PATH` or working directory as a terminal.

## 5b. Claude Desktop via `.mcpb` bundle (recommended)

Instead of wiring an ad-hoc local server, package the compiled server as a
Claude Desktop MCP Bundle (`.mcpb`) that the app installs with a click:

```bash
pnpm mcp:pack
```

This builds `dist/mcp/server.js`, stages it with a minimal `package.json`,
installs only the four external runtime deps (`@modelcontextprotocol/sdk`,
`drizzle-orm`, `pg`, `zod`), and zips everything into
`dist/mcpb/opensheets-finance-<version>.mcpb` (~8 MB). Set `SKIP_BUILD=1` to
skip the compile step when the bundle is already fresh.

Open the resulting `.mcpb` in Claude Desktop. The manifest prompts for:

- `DATABASE_URL` (required, sensitive)
- Opensheets user ID **or** user email (set exactly one)
- Write mode (`readonly` default / `safe-writes` / `full`)
- Optional import directory (allowlists a folder for `finance_import_preview`;
  leave empty to accept only base64 content)

Bundle contents are self-contained; the installed extension does not read from
this repo's `node_modules`. Re-run `pnpm mcp:pack` after any code change.

## 6. Example questions

- "Give me my financial overview for 2026-07."
- "Compare food spending over the last six months."
- "Which unpaid obligations are due in the next fourteen days?"
- "Show my card exposure and remaining limits."
- "Create a paid R$ 89.90 Pix expense at Farmácia today."
- "Transfer R$ 1,000 from checking to savings."

For writes, Claude should first call `finance_lookup_entities` to resolve the
required IDs and summarize the proposed change. Every mutation requires a
stable, non-secret idempotency key.

## Operational notes

- MCP writes do not send payer-notification email.
- Safe writes cannot delete records, edit series, pay invoices, import files,
  or anticipate installments.
- Tool protocol output is written to stdout. Startup and operational failures
  are written to stderr.
- Restart Claude's MCP connection after rebuilding the server.
- If the schema changes, run `pnpm db:migrate` and `pnpm mcp:build` again.
