// Runs as a plain Node.js script BEFORE `playwright test` so the test DB
// exists when Playwright's webServer (Fastify) starts up.
const { execSync } = require("child_process");
const path = require("path");
const { Client } = require("pg");
const { MongoClient } = require("mongodb");
const { seedOwner, seedPostgres, seedMongo } = require("./seed");
const { TEST_DB, POSTGRES_SERVER_URL, MONGO_SERVER_URL, TEST_POSTGRES_URL } = require("./db-config");

async function setupPostgres() {
	const server = new Client({ connectionString: POSTGRES_SERVER_URL });
	await server.connect();
	await server.query(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`);
	// ICU French collation, as the real database: same sort order on every machine
	await server.query(`CREATE DATABASE "${TEST_DB}" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'fr'`);
	await server.end();

	// Create tables from the Drizzle migrations (server/drizzle), including custom ones (unaccent)
	execSync("npx drizzle-kit migrate", {
		cwd: path.resolve(__dirname, "../server"),
		env: { ...process.env, DATABASE_URL: TEST_POSTGRES_URL },
		stdio: "inherit",
	});

	const conn = new Client({ connectionString: TEST_POSTGRES_URL });
	await conn.connect();
	await seedPostgres(conn);
	await seedOwner(conn);
	await conn.end();
	console.log("[setup] Postgres test database ready");
}

async function setupMongoDB() {
	const client = new MongoClient(MONGO_SERVER_URL);
	await client.connect();
	const db = client.db(TEST_DB);

	// Drop all collections for a clean slate
	const collections = await db.listCollections().toArray();
	for (const col of collections) {
		await db.collection(col.name).drop();
	}

	await seedMongo(db);

	await client.close();
	console.log("[setup] MongoDB test database ready");
}

async function main() {
	console.log("[setup] Creating and seeding test databases...");
	await Promise.all([setupPostgres(), setupMongoDB()]);
	console.log("[setup] Done.");
}

main().catch((err) => {
	console.error("[setup] Failed:", err);
	process.exit(1);
});
