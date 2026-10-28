import { defineConfig, devices } from "@playwright/test";
import path from "path";

import { TEST_MONGO_URL, TEST_POSTGRES_URL } from "./db-config";

// written by tests/auth.setup.ts
const OWNER_STATE = path.resolve(__dirname, ".auth/owner.json");

const SERVER_PORT = 3001;
const FRONT_PORT = 5174;
// Garage started by `env:up`, with the dev key and bucket created by docker/garage/init.sh
const GARAGE_PORT = process.env.GARAGE_PORT ?? 3900;

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [["html", { open: "never" }], ["list"]],
	use: {
		baseURL: `http://localhost:${FRONT_PORT}`,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	globalTeardown: path.resolve(__dirname, "global-teardown.ts"),
	webServer: [
		{
			command: [
				`DATABASE_URL=${TEST_POSTGRES_URL}`,
				`MONGODB_URL=${TEST_MONGO_URL}`,
				`PORT=${SERVER_PORT}`,
				`BETTER_AUTH_URL=http://localhost:${SERVER_PORT}`,
				"BETTER_AUTH_SECRET=e2e-secret-e2e-secret-e2e-secret-e2e",
				`FRONT_URL=http://localhost:${FRONT_PORT}`,
				// Set explicitly so server/.env (loaded by dotenv, which never overrides) isn't needed, e.g. in CI
				`S3_ENDPOINT=http://localhost:${GARAGE_PORT}`,
				"S3_REGION=us-east-1",
				"S3_BUCKET=personal-tracker",
				"S3_ACCESS_KEY_ID=GK000000000000000000000000",
				"S3_SECRET_ACCESS_KEY=0000000000000000000000000000000000000000000000000000000000000000",
				// UI mode doesn't show webServer output: follow it with `tail -f e2e/server.log`
				// fetch-mock serves the external calls (Youtube, RSS, france.tv, images) from e2e/mocks/responses
				`npx tsx --import ../e2e/mocks/fetch-mock.mjs src/server.ts > ../e2e/server.log`,
			].join(" "),
			port: SERVER_PORT,
			cwd: path.resolve(__dirname, "../server"),
			reuseExistingServer: false,
			timeout: 30_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: `npx vite preview --port ${FRONT_PORT} --strictPort`,
			port: FRONT_PORT,
			cwd: path.resolve(__dirname, "../front"),
			reuseExistingServer: false,
			timeout: 15_000,
			stdout: "pipe",
			stderr: "pipe",
		},
	],
	projects: [
		// logs the seeded owner in once, the other specs reuse the session
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], storageState: OWNER_STATE },
			dependencies: ["setup"],
			testIgnore: /visitor\.spec\.ts/,
		},
		{
			name: "visitor",
			use: { ...devices["Desktop Chrome"] },
			testMatch: /visitor\.spec\.ts/,
		},
	],
});
