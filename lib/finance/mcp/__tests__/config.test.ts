/** @jest-environment node */

import {
  assertFullWrites,
  assertSafeWrites,
  resolveWriteMode,
  type McpPrincipal,
} from "../config";

const principalWith = (writeMode: McpPrincipal["writeMode"]): McpPrincipal => ({
  userId: "user-1",
  email: "user@example.com",
  name: "User",
  writeMode,
});

describe("Opensheets MCP configuration", () => {
  it("defaults to readonly", () => {
    expect(resolveWriteMode(undefined)).toBe("readonly");
  });

  it("accepts supported write modes", () => {
    expect(resolveWriteMode("readonly")).toBe("readonly");
    expect(resolveWriteMode("safe-writes")).toBe("safe-writes");
    expect(resolveWriteMode("full")).toBe("full");
  });

  it("fails closed for unknown write modes", () => {
    expect(() => resolveWriteMode("write-everything")).toThrow(
      "OPENSHEETS_MCP_WRITE_MODE"
    );
  });
});

describe("Opensheets MCP write-mode gates", () => {
  it("assertSafeWrites rejects only readonly", () => {
    expect(() => assertSafeWrites(principalWith("readonly"))).toThrow(
      "read-only"
    );
    expect(() => assertSafeWrites(principalWith("safe-writes"))).not.toThrow();
    expect(() => assertSafeWrites(principalWith("full"))).not.toThrow();
  });

  it("assertFullWrites allows only full", () => {
    expect(() => assertFullWrites(principalWith("readonly"))).toThrow("full");
    expect(() => assertFullWrites(principalWith("safe-writes"))).toThrow(
      "full"
    );
    expect(() => assertFullWrites(principalWith("full"))).not.toThrow();
  });
});
