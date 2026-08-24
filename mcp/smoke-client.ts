import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import path from "node:path";

async function main() {
  const serverPath = path.resolve("dist/mcp/server.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      OPENSHEETS_MCP_WRITE_MODE:
        process.env.OPENSHEETS_MCP_WRITE_MODE ?? "readonly",
    } as Record<string, string>,
    stderr: "inherit",
  });
  const client = new Client({
    name: "opensheets-mcp-smoke-client",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.equal(tools.tools.length, 23);
    assert.ok(tools.tools.some((tool) => tool.name === "finance_overview"));
    assert.ok(
      tools.tools.some(
        (tool) => tool.name === "finance_transfer_between_accounts"
      )
    );
    assert.ok(
      tools.tools.some((tool) => tool.name === "finance_delete_transaction")
    );
    assert.ok(
      tools.tools.some((tool) => tool.name === "finance_reverse_transfer")
    );
    assert.ok(
      tools.tools.some((tool) => tool.name === "finance_pay_invoice")
    );
    assert.ok(
      tools.tools.some(
        (tool) => tool.name === "finance_reverse_invoice_payment"
      )
    );
    assert.ok(
      tools.tools.some((tool) => tool.name === "finance_update_series")
    );
    assert.ok(
      tools.tools.some((tool) => tool.name === "finance_delete_series")
    );
    assert.ok(
      tools.tools.some(
        (tool) => tool.name === "finance_anticipate_installments"
      )
    );

    const overview = await client.callTool({
      name: "finance_overview",
      arguments: { period: "2026-07" },
    });
    assert.equal(overview.isError, undefined);
    assert.ok(overview.structuredContent);

    if (process.env.MCP_SMOKE_WRITE === "1") {
      const mutation = {
        name: "finance_create_transaction",
        arguments: {
          idempotencyKey: "mcp-smoke-create-2026-07-26",
          name: "Smoke test",
          amount: 25,
          purchaseDate: "2026-07-26",
          transactionType: "Despesa",
          paymentMethod: "Pix",
          accountId: "77777777-7777-4777-8777-777777777777",
          categoryId: "11111111-1111-4111-8111-111111111111",
          settled: true,
        },
      };
      const created = await client.callTool(mutation);
      assert.equal(created.isError, undefined);

      const replay = await client.callTool(mutation);
      assert.equal(replay.isError, undefined);
      const replayContent = replay.structuredContent as
        | Record<string, unknown>
        | undefined;
      assert.equal(replayContent?.replayed, true);

      const transactions = await client.callTool({
        name: "finance_list_transactions",
        arguments: { period: "2026-07" },
      });
      const transactionContent = transactions.structuredContent as
        | Record<string, unknown>
        | undefined;
      assert.equal(transactionContent?.total, 2);
    }

    const resources = await client.listResources();
    assert.equal(resources.resources.length, 5);
    const prompts = await client.listPrompts();
    assert.equal(prompts.prompts.length, 1);

    console.log(
      JSON.stringify({
        ok: true,
        tools: tools.tools.length,
        resources: resources.resources.length,
        prompts: prompts.prompts.length,
        writeTested: process.env.MCP_SMOKE_WRITE === "1",
      })
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
