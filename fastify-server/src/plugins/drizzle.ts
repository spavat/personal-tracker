import { sql } from "drizzle-orm";
import fp from "fastify-plugin";

import { db } from "../db";

export default fp(async (fastify) => {
	// Fail at startup if PostgreSQL is unreachable (the pool connects lazily)
	await db.execute(sql`select 1`);

	// An idle connection killed by PostgreSQL (restart, DROP DATABASE ... FORCE) emits on the pool:
	// without a listener Node crashes the server. The pool already discards that client and reconnects.
	// (code + message only: pg attaches the whole client to the error)
	db.$client.on("error", (err) =>
		fastify.log.warn(`PostgreSQL idle client error: ${(err as { code?: string }).code ?? ""} ${err.message}`),
	);

	fastify.decorate("db", db);
});
