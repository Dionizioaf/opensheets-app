import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";

const host = process.env.MCP_HTTP_HOST ?? "0.0.0.0";
const port = Number(process.env.MCP_HTTP_PORT ?? 8787);
const endpoint = process.env.MCP_HTTP_PATH ?? "/mcp";

function configuredOrigins(): string[] {
  return (process.env.MCP_HTTP_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAuthorized(request: IncomingMessage): boolean {
  const configuredToken = process.env.MCP_HTTP_AUTH_TOKEN?.trim();
  const authorization = request.headers.authorization ?? "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!configuredToken || !suppliedToken) return false;
  const expected = createHash("sha256").update(configuredToken).digest();
  const received = createHash("sha256").update(suppliedToken).digest();
  return timingSafeEqual(expected, received);
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  const origins = configuredOrigins();
  if (origins.includes("*") || (origin && origins.includes(origin))) {
    response.setHeader("Access-Control-Allow-Origin", origins.includes("*") ? "*" : origin!);
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id, WWW-Authenticate");
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const httpServer = createServer(async (request, response) => {
  applyCors(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok", service: "opensheets-mcp" });
    return;
  }

  const requestPath = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (requestPath !== endpoint) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (!isAuthorized(request)) {
    response.setHeader("WWW-Authenticate", 'Bearer realm="opensheets-mcp"');
    sendJson(response, 401, { error: "A valid Bearer token is required." });
    return;
  }

  try {
    // Stateless mode prevents one public client from inheriting another
    // client's in-memory MCP session. The bearer token and fixed principal
    // are resolved for every request.
    const server = await createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error("[opensheets-mcp] HTTP request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "MCP request failed." });
    } else {
      response.end();
    }
  }
});

if (!process.env.MCP_HTTP_AUTH_TOKEN?.trim()) {
  console.error("[opensheets-mcp] MCP_HTTP_AUTH_TOKEN is required.");
  process.exit(1);
}

httpServer.listen(port, host, () => {
  console.error(`[opensheets-mcp] Streamable HTTP listening on http://${host}:${port}${endpoint}`);
});
