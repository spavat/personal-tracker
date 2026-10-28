import { MongoClient } from "mongodb";
import { Client } from "pg";

import { MONGO_SERVER_URL, POSTGRES_SERVER_URL, TEST_DB } from "./db-config";

export default async function globalTeardown() {
	console.log("[teardown] Dropping test databases...");

	await Promise.all([
		(async () => {
			const conn = new Client({ connectionString: POSTGRES_SERVER_URL });
			await conn.connect();
			// FORCE: the test server may still hold connections
			await conn.query(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`);
			await conn.end();
			console.log("[teardown] Postgres test database dropped");
		})(),
		(async () => {
			const client = new MongoClient(MONGO_SERVER_URL);
			await client.connect();
			await client.db(TEST_DB).dropDatabase();
			await client.close();
			console.log("[teardown] MongoDB test database dropped");
		})(),
	]);
}
