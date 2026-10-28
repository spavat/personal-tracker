# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Project Overview

This project is an npm workspaces monorepo splitted into 4 packages:

- front: React application (Vite)
- server: Node.js service based on fastify.
- shared: Mostly zod schemas (and typescript type) which can be used by both front & server.
- e2e: Playwright end-to-end tests.

The app is organised by domain (calendar, context-tags, game, internet, lifespan, money, music, reading-book, reading-manga, show, sport); each domain has a matching folder in `server/src/routes/`, `front/src/modules/`, `front/src/routes/` and a `shared/src/schemas/<domain>.schema.ts`.

## Commands

Run from the repo root unless stated otherwise.

- `npm run dev:up` / `npm run dev:down`: start/stop PostgreSQL, MongoDB and Garage (S3) in Docker with the persistent external dev volumes (create them once with `docker volume create personal-tracker-{postgres,mongo,garage-meta,garage-data}`).
- `npm run dev --prefix server`: server in watch mode (tsx), port 3000.
- `npm run front`: Vite dev server.
- `npm run dev --prefix shared`: rebuild `shared/dist` on change (the server consumes the built `dist`; the front aliases `shared/src` directly in `vite.config.ts`).
- `npm run lint` (oxlint), `npm run fmt` / `npm run fmt:check` (oxfmt).
- `npm run typecheck --prefix server`, `npx tsc --noEmit -p front`.
- Server unit tests (vitest, `server/src/**/*.test.ts` only): `npm test --prefix server`; single file: `cd server && npx vitest run src/routes/sport/sport.routes.test.ts`; single test: add `-t "<name>"`. The legacy `server/test/` dir (node:test, needs a live DB) is not run by vitest.
- E2E: `npm test` starts a separate docker stack (project name and ports, PG 5433 / Mongo 27018 / Garage 3901, set in `e2e/test.env`), builds shared/server/front, recreates and seeds the test DBs (`e2e/setup-db.js`, `e2e/seed.js`), then runs Playwright (server on 3001, `vite preview` on 5174). Single spec once the stack is built: `npx playwright test --config e2e/playwright.config.ts e2e/tests/music.spec.ts`. Server output goes to `e2e/server.log`. Also `npm run test:ui`, `test:headed`, `test:debug`.
- Drizzle (from `server/`, needs `DATABASE_URL`): `npx drizzle-kit generate` / `npx drizzle-kit migrate`. Migrations live in `server/drizzle/`.

## Server

Backend of the application. Query the databases (mongoDB and PostgreSQL)

- `src/app.ts` autoloads `src/plugins/` then every `*.routes.ts` under `src/routes/`; the folder path becomes the URL prefix (e.g. `routes/money/accounts/` → `/money/accounts`).
- Two databases side by side:
    - PostgreSQL through Drizzle (`fastify.db`, schema in `src/db/schema.ts`, relations in `src/db/relations.ts`): currently `money` and `show`.
    - MongoDB through `@fastify/mongodb` (`fastify.mongo`, native driver, no ORM): all other domains.
    - Files (GPX, thumbnails, images) are stored in S3-compatible Garage (`src/config/s3.ts`).
- Each domain follows the same layering: `*.routes.ts` (Fastify plugin; instantiates repositories and use cases, declares zod schemas) → `*.useCases.ts` (one class per use case with an `execute()` method) → `*.repository.ts` (DB access only). Pure domain logic goes in `*.entity.ts`.
- Validations around the endpoints should be using zod schema (defined in shared library), through `withTypeProvider<ZodTypeProvider>()` and `schema: { querystring | body, response }`.
- HTTP verbs: `GET` never changes data (actions like import/sync/add use `POST`). Deletes use `DELETE` with the ids in the path (`DELETE /:id`, or `DELETE /games/:gameId/plays/:playId` for a sub-document), validated by `schema: { params }`, never a body. Creates/updates stay `POST` (`POST /save` upserts, or money's `POST /` + `POST /:id`).
- Front calls go through `fetchJson` (reads), `sendJson(url, method, body?)` (writes) and `withQuery(url, params)` (query strings, encoded) from `front/src/api-utils.ts`.
- Unit tests are co-located (`*.routes.test.ts`, `*.useCases.test.ts`, `*.entity.test.ts`). Route tests use `src/test-support/route-harness.ts` (`buildRouteApp(plugin, { mongo, db })`) with the fakes in `src/test-support/` (`fake-mongo`, `fake-drizzle`) and `app.inject()`; no real DB.

## Front

- Framework: No global framework. tanstack/react-router for the routing (file-based in `src/routes/`, `routeTree.gen.ts` is generated by the Vite plugin — do not edit), react-hook-form for the form, tanstack/react-query for the data.
- Page/feature code lives in `src/modules/<domain>/` (with an `api.ts` for fetch calls, using `fetchJson` from `src/api-utils.ts` and `API_BASE_URL` from `VITE_API_BASE_URL`); `src/routes/` files are thin route definitions pointing to it.
- Styling: Plain CSS. Global CSS is defined in App.css. Custom CSS for each module should be in /modules/[name]/[name].css. Each module index encapsule the Outlet with a particular class that should prevent module css to override other module css.
- Icons: font-awesome or direct emoji if found
- UI labels are in French.

## Shared

Private library exposing Zod schema and typescript types shared by the front and the server, imported as `@personal-tracker/shared/<domain>`. Adding a new schema file requires a new entry in `shared/package.json` `exports` **and** a matching alias in `front/vite.config.ts`.
