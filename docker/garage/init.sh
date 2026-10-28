#!/usr/bin/env bash
# Idempotent Garage setup: single-node layout, dev access key, bucket.
# Garage's image has no shell, so commands run through `docker compose exec`.
set -euo pipefail

BUCKET="personal-tracker"
KEY_NAME="dev"
KEY_ID="GK000000000000000000000000"
KEY_SECRET="0000000000000000000000000000000000000000000000000000000000000000"

garage() {
	docker compose exec -T -e RUST_LOG=warn garage /garage "$@"
}

if garage status | grep -q "NO ROLE ASSIGNED"; then
	NODE_ID="$(garage node id -q | cut -d@ -f1)"
	garage layout assign -z dc1 -c 1G "$NODE_ID"
	garage layout apply --version 1
fi

if ! garage key info "$KEY_NAME" >/dev/null 2>&1; then
	garage key import --yes -n "$KEY_NAME" "$KEY_ID" "$KEY_SECRET"
fi

if ! garage bucket info "$BUCKET" >/dev/null 2>&1; then
	garage bucket create "$BUCKET"
	garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME"
fi

echo "[garage] ready: bucket=$BUCKET key=$KEY_ID"
