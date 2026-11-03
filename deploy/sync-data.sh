#!/usr/bin/env bash
# Overwrites the VPS databases with a copy of the local dev ones (local stays the source of truth).
# Usage, from anywhere, dev stack up (npm run dev:up): deploy/sync-data.sh <ssh host, e.g. user@vps>
set -euo pipefail

VPS="${1:?Usage: $0 <ssh host>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="~/apps/personal-tracker"

local_compose() {
	docker compose -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.dev.yml" "$@"
}
remote_compose() {
	ssh "$VPS" "cd $REMOTE_DIR && docker compose $*"
}

# Make sure the databases run and nothing writes during the restore
remote_compose up -d --wait postgres mongo
remote_compose stop server

echo "[sync] postgres"
local_compose exec -T postgres pg_dump -U tracker -Fc personal_tracker |
	remote_compose exec -T postgres pg_restore -U tracker -d personal_tracker --clean --if-exists --no-owner

echo "[sync] mongo"
local_compose exec -T mongo mongodump --quiet --archive --db personal_tracker |
	remote_compose exec -T mongo mongorestore --quiet --archive --drop

remote_compose up -d --wait
echo "[sync] done"
