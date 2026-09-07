#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the app and the public, bearer-protected MCP endpoint to Docker over SSH.
# Usage: ./scripts/deploy-remote.sh

REMOTE_HOST="${DEPLOY_HOST:-root@177.153.203.62}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/opensheets}"
SSH_OPTIONS=(${DEPLOY_SSH_OPTIONS:-})
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

command -v ssh >/dev/null || { echo "ssh is required" >&2; exit 1; }
command -v rsync >/dev/null || { echo "rsync is required" >&2; exit 1; }
[[ -f "$PROJECT_DIR/.env" ]] || { echo "Create $PROJECT_DIR/.env before deploying" >&2; exit 1; }

has_nonempty_env_value() {
  local variable="$1"
  awk -F= -v key="$variable" '
    $1 == key {
      value = $0
      sub(/^[^=]*=/, "", value)
      if (value !~ /^[[:space:]]*$/) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$PROJECT_DIR/.env"
}

required_env=(DATABASE_URL BETTER_AUTH_SECRET OPENSHEETS_MCP_WRITE_MODE MCP_HTTP_AUTH_TOKEN)
for variable in "${required_env[@]}"; do
  if ! has_nonempty_env_value "$variable"; then
    echo "Missing or empty $variable in .env" >&2
    exit 1
  fi
done

if has_nonempty_env_value OPENSHEETS_MCP_USER_ID && has_nonempty_env_value OPENSHEETS_MCP_USER_EMAIL; then
  echo "Set exactly one of OPENSHEETS_MCP_USER_ID or OPENSHEETS_MCP_USER_EMAIL" >&2
  exit 1
fi
if ! has_nonempty_env_value OPENSHEETS_MCP_USER_ID && ! has_nonempty_env_value OPENSHEETS_MCP_USER_EMAIL; then
  echo "Configure OPENSHEETS_MCP_USER_ID or OPENSHEETS_MCP_USER_EMAIL in .env" >&2
  exit 1
fi
MCP_TOKEN_LENGTH="$(awk -F= '$1 == "MCP_HTTP_AUTH_TOKEN" { value = $0; sub(/^[^=]*=/, "", value); print length(value) }' "$PROJECT_DIR/.env")"
if [[ "${MCP_TOKEN_LENGTH:-0}" -lt 32 ]]; then
  echo "MCP_HTTP_AUTH_TOKEN must be at least 32 characters" >&2
  exit 1
fi

echo "Deploying Opensheets to $REMOTE_HOST:$REMOTE_DIR"
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete \
  --exclude '.env' --exclude '.next' --exclude 'dist' --exclude 'node_modules' \
  --exclude 'logs' --exclude '.git' \
  -e "ssh ${DEPLOY_SSH_OPTIONS:-}" "$PROJECT_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"
scp "${SSH_OPTIONS[@]}" "$PROJECT_DIR/.env" "$REMOTE_HOST:$REMOTE_DIR/.env"
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" "chmod 600 '$REMOTE_DIR/.env' && cd '$REMOTE_DIR' && docker compose up -d --build app mcp db && docker compose ps"

echo "Waiting for application and MCP health checks..."
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" "cd '$REMOTE_DIR' && for i in \$(seq 1 30); do curl -fsS http://127.0.0.1:3000/api/health >/dev/null && curl -fsS http://127.0.0.1:8787/health >/dev/null && exit 0; sleep 2; done; docker compose logs --tail=100 app mcp; exit 1"
echo "Deployment complete: app http://$REMOTE_HOST:3000 | MCP http://$REMOTE_HOST:8787/mcp"
