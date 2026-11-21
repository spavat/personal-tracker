# Deployment (VPS, https://tracker.spvt.fr)

Pipeline (`.github/workflows/ci.yml`): `checks` (lint, fmt, typecheck, unit) + `e2e` on every PR/push → on `main` only, `build` pushes `ghcr.io/spavat/personal-tracker-{server,front}:{latest,<sha>}` → `deploy` waits for a manual approval, then SSHes to the VPS and runs `docker compose pull && up -d` with the approved sha.

The server image runs the Drizzle migrations (`dist/migrate.js`) before starting.

During a deploy, the job starts the `maintenance` service (Compose profile, never started by a plain `docker compose up`) before recreating `front`/`server`, and stops it once they are healthy. Meanwhile Traefik falls back to it (lowest-priority router on the same host): a 503 page that reloads itself every 5 s.

## One-time setup

### GitHub

- Settings → Environments → `production`: add yourself as _Required reviewer_, and the secrets `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY` (private key of a dedicated pair, e.g. `ssh-keygen -t ed25519 -f gh-deploy -N ""`).
- After the first `build` run: Packages → `personal-tracker-server` / `-front` → Package settings → make them public (or `docker login ghcr.io` on the VPS with a `read:packages` token).

### VPS

The stack (compose file, maintenance page, `.env` written from ansible-vault) lives in the `infra` repo
(`stacks/personal-tracker/`) and is deployed to `/opt/stacks/personal-tracker` by its playbook. The `deploy` job only
rewrites `TAG=` in that `.env` (the playbook keeps it). Production variables: `stacks/personal-tracker/.env.j2` in
`infra`; the server refuses to start when one it needs is missing (`server/src/config/env.schema.ts`).

```sh
cat gh-deploy.pub >> ~/.ssh/authorized_keys   # on the VPS, for the deploy job
```

DNS: `tracker.spvt.fr` → VPS (unless a wildcard exists).

### S3 (hosted provider)

Create the bucket and a key limited to it; add a CORS rule allowing `GET` from `https://tracker.spvt.fr`. Copy the local Garage content (endpoint `http://localhost:3900`, key in `docker/garage/init.sh`), e.g. `rclone sync garage:personal-tracker provider:<bucket>`.

### Data

```sh
deploy/sync-data.sh user@vps   # overwrites the VPS databases with the local ones (owner account included)
```

Rerun it whenever the VPS copy should be refreshed. The VPS databases are backed up every night, and restoring them
from a backup is described in `docs/backup.md` of the `infra` repo.

## Notes

- The Strava import reads a local export folder: not available on the VPS.
- Rollback: re-run the `deploy` job of an older successful workflow run.
