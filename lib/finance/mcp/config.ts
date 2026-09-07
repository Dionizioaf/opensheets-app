import { user } from "@/db/schema";
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export const MCP_WRITE_MODES = ["readonly", "safe-writes", "full"] as const;
export type McpWriteMode = (typeof MCP_WRITE_MODES)[number];

export type McpPrincipal = {
  userId: string;
  email: string;
  name: string;
  writeMode: McpWriteMode;
};

export function resolveWriteMode(
  value = "readonly"
): McpWriteMode {
  if (!value) return "readonly";
  if (MCP_WRITE_MODES.includes(value as McpWriteMode)) {
    return value as McpWriteMode;
  }
  throw new Error(
    `OPENSHEETS_MCP_WRITE_MODE must be one of: ${MCP_WRITE_MODES.join(", ")}.`
  );
}

export async function resolveMcpPrincipal(): Promise<McpPrincipal> {
  const configuredId = process.env.OPENSHEETS_MCP_USER_ID?.trim();
  const configuredEmail = process.env.OPENSHEETS_MCP_USER_EMAIL?.trim();

  if (Boolean(configuredId) === Boolean(configuredEmail)) {
    throw new Error(
      "Configure exactly one of OPENSHEETS_MCP_USER_ID or OPENSHEETS_MCP_USER_EMAIL."
    );
  }

  const record = await db.query.user.findFirst({
    columns: { id: true, email: true, name: true },
    where: configuredId
      ? eq(user.id, configuredId)
      : and(eq(user.email, configuredEmail!)),
  });

  if (!record) {
    throw new Error("The configured Opensheets MCP user was not found.");
  }

  return {
    userId: record.id,
    email: record.email,
    name: record.name,
    writeMode: resolveWriteMode(process.env.OPENSHEETS_MCP_WRITE_MODE),
  };
}

export function assertSafeWrites(principal: McpPrincipal): void {
  if (principal.writeMode === "readonly") {
    throw new Error(
      "This MCP server is read-only. Set OPENSHEETS_MCP_WRITE_MODE=safe-writes to enable guarded mutations."
    );
  }
}

/**
 * Gate for high-risk tools (deletion, reversal, invoice payment, series editing,
 * anticipation, import). Only the `full` write mode unlocks these; both
 * `readonly` and `safe-writes` are rejected.
 */
export function assertFullWrites(principal: McpPrincipal): void {
  if (principal.writeMode !== "full") {
    throw new Error(
      "This operation is high-risk and requires OPENSHEETS_MCP_WRITE_MODE=full."
    );
  }
}
