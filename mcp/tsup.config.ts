import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["mcp/server.ts", "mcp/http-server.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node22",
  clean: true,
  outDir: "dist/mcp",
  noExternal: [/.*/],
});
