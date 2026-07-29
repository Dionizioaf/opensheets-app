/** @jest-environment node */

import { resolveWriteMode } from "../config";

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
