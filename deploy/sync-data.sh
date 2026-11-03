#!/usr/bin/env bash
# Overwrites the VPS databases with a copy of the local dev ones (local stays the source of truth).
# Local databases run natively (pg_dump and mongodump needed); URLs default to the server's defaults.
# Usage: [LOCAL_DATABASE_URL=…] [LOCAL_MONGODB_URL=…] deploy/sync-data.sh <ssh host, e.g. user@vps>
set -euo pipefail

VPS="${1:?Usage: $0 <ssh host>}"
LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://tracker:tracker@localhost:5432/personal_tracker}"
LOCAL_MONGODB_URL="${LOCAL_MONGODB_URL:-mongodb://localhost:27017/personal_tracker}"
REMOTE_DIR="~/apps/personal-tracker"

remote_compose() {
	ssh "$VPS" "cd $REMOTE_DIR && docker compose $*"
}

# Make sure the databases run and nothing writes during the restore
remote_compose up -d --wait postgres mongo
remote_compose stop server

echo "[sync] postgres"
pg_dump -Fc "$LOCAL_DATABASE_URL" |
	remote_compose exec -T postgres pg_restore -U tracker -d personal_tracker --clean --if-exists --no-owner

echo "[sync] mongo"
mongodump --quiet --archive --uri "$LOCAL_MONGODB_URL" |
	remote_compose exec -T mongo mongorestore --quiet --archive --drop

remote_compose up -d --wait
echo "[sync] done"
