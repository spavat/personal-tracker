// Test databases connection settings, shared by setup-db.js, seed.js, global-teardown.ts and playwright.config.ts.
const path = require("path");

// Same ports as the docker stack; variables already set in the shell win
process.loadEnvFile(path.join(__dirname, "test.env"));

const TEST_DB = "personal_tracker_test";
const POSTGRES_PORT = process.env.POSTGRES_PORT ?? "5432";
const MONGO_PORT = process.env.MONGO_PORT ?? "27017";

// Servers (to create / drop the test database)
const POSTGRES_SERVER_URL = `postgresql://tracker:tracker@localhost:${POSTGRES_PORT}/postgres`;
const MONGO_SERVER_URL = `mongodb://localhost:${MONGO_PORT}`;

// Test database
const TEST_POSTGRES_URL = `postgresql://tracker:tracker@localhost:${POSTGRES_PORT}/${TEST_DB}`;
const TEST_MONGO_URL = `${MONGO_SERVER_URL}/${TEST_DB}`;

module.exports = { TEST_DB, POSTGRES_SERVER_URL, MONGO_SERVER_URL, TEST_POSTGRES_URL, TEST_MONGO_URL };
