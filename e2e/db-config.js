// Test databases connection settings, shared by setup-db.js, seed.js and playwright.config.ts.
const path = require("path");

// Same ports as the docker stack; variables already set in the shell win
process.loadEnvFile(path.join(__dirname, "test.env"));

// Each Playwright worker has its own databases, server and front (index = Playwright's parallelIndex)
const WORKERS = Number(process.env.E2E_WORKERS ?? 3);
const POSTGRES_PORT = process.env.POSTGRES_PORT ?? "5432";
const MONGO_PORT = process.env.MONGO_PORT ?? "27017";

// Servers (to create / drop the test databases)
const POSTGRES_SERVER_URL = `postgresql://tracker:tracker@localhost:${POSTGRES_PORT}/postgres`;
const MONGO_SERVER_URL = `mongodb://localhost:${MONGO_PORT}`;

// Test databases and app ports of a worker
const testDb = (i) => `personal_tracker_test_${i}`;
const testPostgresUrl = (i) => `postgresql://tracker:tracker@localhost:${POSTGRES_PORT}/${testDb(i)}`;
const testMongoUrl = (i) => `${MONGO_SERVER_URL}/${testDb(i)}`;
const serverPort = (i) => 3001 + i;
const frontPort = (i) => 5174 + i;

// Index of the current Playwright worker (set by Playwright in its worker processes, 0 elsewhere)
const workerIndex = () => Number(process.env.TEST_PARALLEL_INDEX ?? 0);

module.exports = {
	WORKERS,
	POSTGRES_SERVER_URL,
	MONGO_SERVER_URL,
	testDb,
	testPostgresUrl,
	testMongoUrl,
	serverPort,
	frontPort,
	workerIndex,
};
