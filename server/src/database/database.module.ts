import { Inject, Logger, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";
import { MongoClient } from "mongodb";

import { Env } from "../config/env.schema.js";
import { DRIZZLE, MONGO_CLIENT, MONGO_DB } from "./database.tokens.js";
import { createDrizzle, Drizzle } from "./drizzle.js";

@Module({
	providers: [
		{
			provide: MONGO_CLIENT,
			inject: [ConfigService],
			useFactory: async (config: ConfigService<Env, true>) => {
				const client = new MongoClient(config.get("MONGODB_URL", { infer: true }));
				await client.connect();
				return client;
			},
		},
		{
			provide: MONGO_DB,
			inject: [MONGO_CLIENT],
			useFactory: (client: MongoClient) => client.db(),
		},
		{
			provide: DRIZZLE,
			inject: [ConfigService],
			useFactory: async (config: ConfigService<Env, true>) => {
				const logger = new Logger("Drizzle");

				const db = createDrizzle(config.get("DATABASE_URL", { infer: true }));
				// Fail at startup if PostgreSQL is unreachable (the pool connects lazily)
				await db.execute(sql`select 1`);

				// An idle connection killed by PostgreSQL (restart, DROP DATABASE ... FORCE) emits on the pool:
				// without a listener Node crashes the server. The pool already discards that client and reconnects.
				// (code + message only: pg attaches the whole client to the error)
				db.$client.on("error", (err: Error & { code?: string }) =>
					logger.warn(
						`PostgreSQL idle client error: ${(err as { code?: string }).code ?? ""} ${err.message}`,
					),
				);
				return db;
			},
		},
	],
	exports: [MONGO_DB, DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
	private readonly logger = new Logger(DatabaseModule.name);

	constructor(
		@Inject(MONGO_CLIENT) private readonly client: MongoClient,
		@Inject(DRIZZLE) private readonly db: Drizzle,
	) {}

	async onApplicationShutdown() {
		this.logger.log("Closing MongoDB client...");
		await this.client.close();

		this.logger.log("Closing PostgreSQL database...");
		await this.db.$client.end();
	}
}
