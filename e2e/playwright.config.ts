import { defineConfig, devices } from "@playwright/test";
import path from "path";

import { WORKERS, frontPort, serverPort, testMongoUrl, testPostgresUrl } from "./db-config";

// Garage started by `env:up`, with the dev key and bucket created by docker/garage/init.sh
const GARAGE_PORT = process.env.GARAGE_PORT ?? 3900;

// Each worker i has its own server (port 3001 + i, databases personal_tracker_test_<i>)
// and its own front (port 5174 + i, proxying /api to that server); the fixtures pick them by parallelIndex.
const workers = Array.from({ length: WORKERS }, (_, i) => i);

export default defineConfig<{}, { asOwner: boolean }>({
	testDir: "./tests",
	// a spec file runs in one worker, its tests in order
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: WORKERS,
	reporter: [["html", { open: "never" }], ["list"]],
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: workers.flatMap((i) => [
		{
			command: [
				`DATABASE_URL=${testPostgresUrl(i)}`,
				`MONGODB_URL=${testMongoUrl(i)}`,
				`PORT=${serverPort(i)}`,
				`BETTER_AUTH_URL=http://localhost:${serverPort(i)}`,
				"BETTER_AUTH_SECRET=e2e-secret-e2e-secret-e2e-secret-e2e",
				`FRONT_URL=http://localhost:${frontPort(i)}`,
				// Set explicitly so server/.env (loaded by dotenv, which never overrides) isn't needed, e.g. in CI
				`S3_ENDPOINT=http://localhost:${GARAGE_PORT}`,
				"S3_REGION=us-east-1",
				"S3_BUCKET=personal-tracker",
				"S3_ACCESS_KEY_ID=GK000000000000000000000000",
				"S3_SECRET_ACCESS_KEY=0000000000000000000000000000000000000000000000000000000000000000",
				// served by fetch-mock from e2e/mocks/responses/gopodder-episodes.json
				"GOPODDER_URL=https://gopodder.example.com",
				"GOPODDER_USERNAME=tracker",
				"GOPODDER_PASSWORD=e2e-password",
				// no daily store sync, and no real store account from server/.env
				"GAME_SYNC_SCHEDULER=off",
				"STEAM_API_KEY=",
				"STEAM_ID=",
				"GOG_USERNAME=",
				// UI mode doesn't show webServer output: follow it with `tail -f e2e/server-<worker>.log`
				// fetch-mock serves the external calls (Youtube, RSS, france.tv, images) from e2e/mocks/responses
				// the built server (`npm run test:build`): lighter than tsx, one runs per worker
				`node --import ../e2e/mocks/fetch-mock.mjs dist/server.js > ../e2e/server-${i}.log`,
			].join(" "),
			port: serverPort(i),
			cwd: path.resolve(__dirname, "../server"),
			reuseExistingServer: false,
			timeout: 60_000,
			stdout: "pipe" as const,
			stderr: "pipe" as const,
		},
		{
			command: `API_PROXY_TARGET=http://localhost:${serverPort(i)} npx vite preview --port ${frontPort(i)} --strictPort`,
			port: frontPort(i),
			cwd: path.resolve(__dirname, "../front"),
			reuseExistingServer: false,
			timeout: 30_000,
			stdout: "pipe" as const,
			stderr: "pipe" as const,
		},
	]),
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], asOwner: true },
			testIgnore: /visitor\.spec\.ts/,
		},
		{
			name: "visitor",
			use: { ...devices["Desktop Chrome"] },
			testMatch: /visitor\.spec\.ts/,
		},
	],
});
