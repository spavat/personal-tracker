// Runs as a plain Node.js script BEFORE `playwright test` so the test DBs
// exist when Playwright's webServers (Fastify) start up: one Postgres and one Mongo database per worker.
const { execSync } = require("child_process");
const path = require("path");
const { Client } = require("pg");
const { MongoClient } = require("mongodb");
const { seedOwner, seedPostgres, seedMongo } = require("./seed");
const { WORKERS, POSTGRES_SERVER_URL, MONGO_SERVER_URL, testDb, testPostgresUrl } = require("./db-config");

const workers = Array.from({ length: WORKERS }, (_, i) => i);

async function setupPostgres() {
	const server = new Client({ connectionString: POSTGRES_SERVER_URL });
	await server.connect();
	for (const i of workers) {
		await server.query(`DROP DATABASE IF EXISTS "${testDb(i)}" WITH (FORCE)`);
	}
	// ICU French collation, as the real database: same sort order on every machine
	await server.query(`CREATE DATABASE "${testDb(0)}" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'fr'`);

	// Create tables from the Drizzle migrations (server/drizzle), including custom ones (unaccent)
	execSync("npx drizzle-kit migrate", {
		cwd: path.resolve(__dirname, "../server"),
		env: { ...process.env, DATABASE_URL: testPostgresUrl(0) },
		stdio: "inherit",
	});

	const conn = new Client({ connectionString: testPostgresUrl(0) });
	await conn.connect();
	await seedPostgres(conn);
	await seedOwner(conn);
	await conn.end();

	// The other workers get a copy of the seeded database (no connection to it may be open)
	for (const i of workers.slice(1)) {
		await server.query(`CREATE DATABASE "${testDb(i)}" TEMPLATE "${testDb(0)}"`);
	}
	await server.end();
	console.log(`[setup] Postgres test databases ready (${WORKERS})`);
}

async function setupMongoDB() {
	const client = new MongoClient(MONGO_SERVER_URL);
	await client.connect();
	await Promise.all(
		workers.map(async (i) => {
			const db = client.db(testDb(i));
			// Drop all collections for a clean slate
			const collections = await db.listCollections().toArray();
			for (const col of collections) {
				await db.collection(col.name).drop();
			}
			await seedMongo(db);
		}),
	);
	await client.close();
	console.log(`[setup] MongoDB test databases ready (${WORKERS})`);
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
