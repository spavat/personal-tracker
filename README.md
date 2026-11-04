# Personal Tracker

A personal web app to track everyday life: calendar, games, internet, lifespan of objects, money, music, books, manga, shows and sport. The UI is in French.

## Stack

npm workspaces monorepo:

| Package   | Role                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- |
| `front/`  | React + Vite, TanStack Router (file-based) and Query, react-hook-form, plain CSS                  |
| `server/` | Fastify API, auth with better-auth, PostgreSQL through Drizzle, MongoDB through the native driver |
| `shared/` | Zod schemas and TypeScript types used by both, imported as `@personal-tracker/shared/<domain>`    |
| `e2e/`    | Playwright end-to-end tests                                                                       |

Storage:

- **PostgreSQL**: `money` and `show` domains, plus auth.
- **MongoDB**: every other domain.
- **S3 Storage**: files such as GPX tracks, thumbnails and images.

All three run locally in Docker.

## Prerequisites

- Node.js 26 (the version used in CI)
- Docker with Docker Compose

## Getting started

```sh
npm install

# One time only: create the persistent dev volumes
docker volume create personal-tracker-postgres
docker volume create personal-tracker-mongo
docker volume create personal-tracker-garage-meta
docker volume create personal-tracker-garage-data

# Start PostgreSQL, MongoDB and Garage, then create the bucket and the dev key
npm run dev:up

# Build the shared package (the server reads shared/dist)
npm run build --prefix shared

# Apply the database migrations (from server/)
cd server && npx drizzle-kit migrate
```

### Configuration

The server loads `server/.env`. The defaults already point to the local Docker services, except for these:

```sh
BETTER_AUTH_SECRET=<a random string>
S3_ENDPOINT=http://localhost:3900
S3_ACCESS_KEY_ID=GK000000000000000000000000
S3_SECRET_ACCESS_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

The S3 key is the dev key created by `docker/garage/init.sh`.

| Variable                      | Default                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `PORT`                        | `3000`                                                         |
| `DATABASE_URL`                | `postgresql://tracker:tracker@localhost:5432/personal_tracker` |
| `MONGODB_URL`                 | `mongodb://localhost:27017/personal_tracker`                   |
| `FRONT_URL` (comma-separated) | `http://localhost:5173`                                        |
| `BETTER_AUTH_URL`             | `http://localhost:3000`                                        |
| `S3_BUCKET` / `S3_REGION`     | `personal-tracker` / `us-east-1`                               |

The front reads `VITE_API_BASE_URL` from `front/.env`, for example `http://localhost:3000`.

> Use the same host everywhere (`localhost` or an IP, never both) in `FRONT_URL`, `BETTER_AUTH_URL`, `VITE_API_BASE_URL` and the browser address bar. If you mix them, the auth cookie isn't sent and login fails without any error.

### Owner account

Sign-up is disabled on the public API. To create the single owner account, run this from `server/`:

```sh
npx tsx scripts/create-owner.ts <email> <password> [name]
```

### Run

Run each of these in its own terminal:

```sh
npm run dev --prefix shared   # rebuild shared/dist on change
npm run dev --prefix server   # API on http://localhost:3000
npm run front                 # Vite on http://localhost:5173
```

Stop the databases with `npm run dev:down`.

## Checks and tests

```sh
npm run lint                      # oxlint
npm run fmt                       # oxfmt (npm run fmt:check to only check)
npm run typecheck --prefix server
npx tsc --noEmit -p front
npm test --prefix server          # server unit tests (vitest, no database needed)
npm test                          # end-to-end tests (Playwright)
```

`npm test` starts a separate Docker stack, so you can run it while the dev databases are up. That stack uses PostgreSQL on 5433, MongoDB on 27018 and Garage on 3901 (see `e2e/test.env`). The command then builds the packages, seeds the test databases and runs Playwright. Other modes: `npm run test:ui`, `test:headed` and `test:debug`.

A Husky pre-commit hook runs oxfmt and oxlint on the staged files.

## Project layout

The code is split by domain. Each domain has a folder in `server/src/routes/`, `front/src/modules/` and `front/src/routes/`, plus a `shared/src/schemas/<domain>.schema.ts` file.

- **Server**: `*.routes.ts` (Fastify plugin with the zod schemas) calls `*.useCases.ts` (one class per use case), which calls `*.repository.ts` (database access only). Pure domain logic goes in `*.entity.ts`. The routes are autoloaded, and the folder path becomes the URL prefix.
- **Front**: the files in `src/routes/` are thin route definitions. The pages and their `api.ts` live in `src/modules/<domain>/`.

[CLAUDE.md](CLAUDE.md) holds the full set of conventions (HTTP verbs, file naming, CSS scoping, adding a shared schema).

## Deployment

CI runs in GitHub Actions. Pushes to `main` build Docker images and deploy them to a VPS after manual approval. See [deploy/README.md](deploy/README.md).
