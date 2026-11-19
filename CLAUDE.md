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
- server: Node.js service based on NestJS 12 (NodeAdapter, ESM).
- shared: Mostly zod schemas (and typescript type) which can be used by both front & server.
- e2e: Playwright end-to-end tests.

The app is organised by domain (calendar, context-tags, game, internet, lifespan, money, music, reading-book, reading-manga, show, sport); each domain has a matching folder in `server/src/`, `front/src/modules/`, `front/src/routes/` and a `shared/src/schemas/<domain>.schema.ts`.

## Commands

Run from the repo root unless stated otherwise.

- `npm run dev:up` / `npm run dev:down`: start/stop PostgreSQL, MongoDB and Garage (S3) in Docker with the persistent external dev volumes (create them once with `docker volume create personal-tracker-{postgres,mongo,garage-meta,garage-data}`).
- `npm run dev --prefix server`: server in watch mode (`tsc -w` + `node --watch dist/main.js`), port 3000. It reads `server/.env`; restart it after editing `.env` (the watch only follows `dist/`).
- `npm run front`: Vite dev server.
- `npm run dev --prefix shared`: rebuild `shared/dist` on change (the server consumes the built `dist`; the front aliases `shared/src` directly in `vite.config.ts`).
- `npm run lint` (oxlint), `npm run fmt` / `npm run fmt:check` (oxfmt).
- `npm run typecheck --prefix server`, `npx tsc --noEmit -p front`.
- Server unit tests (vitest, `server/src/**/*.test.ts`): `npm test --prefix server`; single file: `cd server && npx vitest run src/sport/sport.controller.test.ts`; single test: add `-t "<name>"`.
- Server scripts, run from the build (`npm run build --prefix server` first; Node can't strip the parameter decorators of a `.ts` file): `npm run migrate | create-owner -- <email> <password> | seed-epic-token --prefix server`.
- E2E: `npm test` starts a separate docker stack (project name and ports, PG 5433 / Mongo 27018 / Garage 3901, set in `e2e/test.env`), builds shared/server/front, recreates and seeds the test DBs (`e2e/setup-db.js`, `e2e/seed.js`), then runs Playwright with `E2E_WORKERS` workers (default 3, in `e2e/db-config.js`). Each worker `i` has its own DBs (`personal_tracker_test_<i>`), built server (port 3001+i) and `vite preview` (port 5174+i, `/api` proxied to its server), and logs the owner in once; `resetDb`/`queryDb`/`updateMongo` act on the current worker's DBs. The test DBs are kept after a run, so once `npm test` has run, a single spec runs directly: `npx playwright test --config e2e/playwright.config.ts e2e/tests/music.spec.ts` (Playwright serves the built `dist`: after a front/server change, `npm run test:build` first; with a different `E2E_WORKERS`, `npm run test:db:reset` first). Server output goes to `e2e/server-<i>.log`. Also `npm run test:ui`, `test:headed`, `test:debug`.
- Drizzle (from `server/`, needs `DATABASE_URL`): `npx drizzle-kit generate` / `npx drizzle-kit migrate`. Migrations live in `server/drizzle/`.

## Server

Backend of the application. Query the databases (mongoDB and PostgreSQL). `fastify-server/` is the former Fastify server, kept for reference only: frozen, not built, tested nor deployed.

- One Nest module per domain (`src/<domain>/<domain>.module.ts`), imported by `src/app.module.ts`. A domain splits into sub-modules (`money/accounts/`, `internet/sync/`) mounted with `RouterModule.register` children; code shared by the sub-modules goes in a `*-shared.module.ts`. A module reads another domain's data through the repository that domain's module `exports` (imports are not re-exported: import `DatabaseModule`/`StorageModule` where you inject them).
- Layering: `*.controller.ts` (HTTP only) → `*.service.ts` (domain logic) → `*.repository.ts` (DB access only); pure domain logic in `*.entity.ts`. One service per module (or sub-module), logging with its own Nest `Logger`.
- File names: `<subject>.<role>.ts`. A resource's module/controller/service/repository are plural like its folder (`artists/artists.service.ts`, class `ArtistsService`), its entity singular (`artist.entity.ts`); domain folders stay singular (`game/`, `sport/`). Helpers take a role too: `.utils.ts` (pure functions), `.query.ts` (DB query builders), `.client.ts` (an outside HTTP source), `.storage.ts`, `.provider.ts`.
- Global enhancers (`src/common/common.module.ts`, `src/auth/auth.module.ts`): the auth guard, the zod validation pipe, the response serializer, the error filter (every error answers `ErrorBodySchema` of `@personal-tracker/shared/errors`), the request context (AsyncLocalStorage). Throw the errors of `src/common/errors.ts` (`NotFoundError` 404, `ConflictError` 409, `BadRequestError` 400, `UpstreamError` 502) with a code of `ErrorCodeSchema` and its params, and an English message for the logs: the front translates the code (`front/src/error-messages.ts`, read by `checkResponse` into an `ApiError`). A new code needs its entry in both (see `.scratch/error-codes/spec.md`).
- Auth: logged in = owner (single account, better-auth served on `/auth/*` by `AuthHandlerMiddleware`). Every route is owner-only by default; `@Public()` opens a GET to visitors. Repositories hide private documents with `privacyMatch()` (request context); `@IsOwner()` gives the flag to a handler.
- Validation with the shared zod schemas: `@Body({ schema })`, `@Query({ schema })`, `@Param({ schema })`; responses with `@SerializeOptions({ schema })` (an array route takes `Schema.element`: arrays are checked item by item).
- Background jobs: `@Cron()` methods (`@nestjs/schedule`), e.g. `src/game/sync/game-sync.job.ts` (daily 04:00 store playtime sync, `GAME_SYNC_SCHEDULER=off` disables it). The job only decides when to run; the logic stays in the domain.
- Two databases side by side:
    - PostgreSQL through Drizzle (`DRIZZLE` token, schema in `src/database/schema.ts`, relations in `src/database/relations.ts`): currently `money`, `show` and `reading-book`.
    - MongoDB (`MONGO_DB` token, native driver, no ORM): all other domains.
    - Files (GPX, thumbnails, images) are stored in S3-compatible Garage (`src/storage/`, `ObjectStorage`).
- Env: validated by `src/config/env.schema.ts` (zod) at startup; read through `ConfigService<Env, true>`.
- HTTP verbs (`.scratch/api-writes/spec.md`): `POST /<resources>` creates (201 + the created resource), `PUT /<resources>/:id` updates (200 + the updated resource, 404 unknown id), `DELETE /<resources>/:id` deletes (`@HttpCode(204)`, 404 unknown id, 409 refused). A sub-document is a resource under its parent (`POST /games/:gameId/plays`, `PUT /games/:gameId/plays/:playId`) and its writes answer it. A route creating a resource can take a related new one inline (a performance with a new place): created in the same transaction, never edited. `GET` never changes data; actions (import, sync, crop…) are `POST /<verb>` with `@HttpCode(200)`. Ids go in the path, validated by `@Param({ schema })`, never in a delete body. Repositories return the saved document (Mongo `findOneAndUpdate` with `returnDocument: "after"`, Drizzle `.returning()`), never the driver result. Front: `saveJson(url, body)` picks `POST url` or `PUT url/:id` from `body.id`.
- Front calls go through `fetchJson` (reads), `sendJson(url, method, body?)` (writes) and `withQuery(url, params)` (query strings, encoded) from `front/src/api-utils.ts`.
- Unit tests are co-located (`*.controller.test.ts`, `*.service.test.ts`, `*.entity.test.ts`). Controller tests boot the module with `src/test-support/test-app.ts` (`buildTestApp(Module, { mongoDb, drizzle, session, storage })`: real global enhancers, fake DBs, S3 and auth) and call `app.inject()`; no real DB.

## Front

- Framework: No global framework. tanstack/react-router for the routing (file-based in `src/routes/`, `routeTree.gen.ts` is generated by the Vite plugin — do not edit), react-hook-form for the form, tanstack/react-query for the data.
- Modal routes (a window over the current page: add/edit/delete…) declare `staticData: { modal: true }`: `src/router.ts` skips the view transition when one opens or closes, otherwise the animated pictures (portraits, posters) are drawn over the modal during the transition.
- Page/feature code lives in `src/modules/<domain>/` (with an `api.ts` for fetch calls, using `fetchJson` from `src/api-utils.ts` and `API_BASE_URL` from `VITE_API_BASE_URL`); `src/routes/` files are thin route definitions pointing to it.
- File names: a file whose main export is a React component is PascalCase and named after it (`PageTitle.tsx`; companions keep the name plus a suffix: `ArtistForm.utils.ts`, `App.css`); everything else is kebab-case (`use-is-owner.ts`, `api.ts`, `search-fn.tsx`, `module.css`). Exempt: `src/routes/` (TanStack naming), `index.tsx` folder entries, `main.tsx`.
- Styling: Plain CSS. Global CSS is defined in App.css. Custom CSS for each module should be in /modules/[name]/[name].css. Each module index encapsule the Outlet with a particular class that should prevent module css to override other module css.
- Icons: font-awesome or direct emoji if found
- UI labels are in French.

## Shared

Private library exposing Zod schema and typescript types shared by the front and the server, imported as `@personal-tracker/shared/<domain>`. Adding a new schema file requires a new entry in `shared/package.json` `exports` **and** a matching alias in `front/vite.config.ts`.

## Agent skills

### Issue tracker

Issues and specs are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
