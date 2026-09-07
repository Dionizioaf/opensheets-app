#!/bin/bash

# Start the compiled Opensheets MCP server independently of the terminal that
# launched it. MCP communicates over stdio; this launcher is useful for keeping
# a local process available for manual/diagnostic use.
set -u

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PID_FILE="$PROJECT_DIR/.mcp-server.pid"
LOG_DIR="$PROJECT_DIR/logs/mcp"
LOG_FILE="$LOG_DIR/server.log"
SERVER_FILE="$PROJECT_DIR/dist/mcp/server.js"

if [ ! -f "$SERVER_FILE" ]; then
  echo "MCP server is not built: $SERVER_FILE"
  echo "Run: pnpm mcp:build"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Opensheets MCP is already running (PID $PID)."
    echo "Log: $LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

mkdir -p "$LOG_DIR"

# Load the project environment, including DATABASE_URL and the configured MCP
# user. Values in .env should use normal dotenv/shell quoting when necessary.
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not configured in $PROJECT_DIR/.env"
  exit 1
fi

if [ -z "${OPENSHEETS_MCP_USER_ID:-}" ] && [ -z "${OPENSHEETS_MCP_USER_EMAIL:-}" ]; then
  echo "Configure OPENSHEETS_MCP_USER_ID or OPENSHEETS_MCP_USER_EMAIL in $PROJECT_DIR/.env"
  exit 1
fi

NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js was not found in PATH."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# The MCP transport is stdio-based and exits when stdin reaches EOF. Keep a
# quiet pipe open so the detached process survives after the launching terminal
# closes. In Bash, the pipeline's background PID is the Node process, which
# keeps the PID file useful for repeat launches.
tail -f /dev/null | nohup "$NODE_BIN" "$SERVER_FILE" >> "$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

# Give the process a moment to fail fast on invalid configuration.
sleep 1
if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "MCP server failed to start. Check: $LOG_FILE"
  tail -20 "$LOG_FILE"
  exit 1
fi

echo "Opensheets MCP started in the background (PID $PID)."
echo "Log: $LOG_FILE"
