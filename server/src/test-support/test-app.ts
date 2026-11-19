import type { Type } from "@nestjs/common";

import { ConfigModule } from "@nestjs/config";
import { type NestNodeApplication, NodeAdapter } from "@nestjs/platform-node";
import { Test } from "@nestjs/testing";
import { vi } from "vitest";

import { AuthModule } from "../auth/auth.module.js";
import { AUTH } from "../auth/auth.tokens.js";
import { configureBodyParsers } from "../body-parsers.js";
import { CommonModule } from "../common/common.module.js";
import { DRIZZLE, MONGO_CLIENT, MONGO_DB } from "../database/database.tokens.js";
import { ObjectStorage } from "../storage/object-storage.js";
import { S3_BUCKET, S3_CLIENT } from "../storage/storage.tokens.js";
import { makeFakeDrizzle } from "./fake-drizzle.js";
import { makeFakeMongo } from "./fake-mongo.js";

export interface TestAppOptions {
	/** fake Mongo `Db` (e.g. `makeFakeMongo().mongo.db`); a fresh one by default */
	mongoDb?: unknown;
	/** fake Drizzle client (e.g. `makeFakeDrizzle().db`); a fresh one by default */
	drizzle?: object;
	/** what `auth.api.getSession` resolves to: `null` = anonymous, any object = owner */
	session?: unknown;
	/** fake `ObjectStorage` (S3); by default every method is a `vi.fn()` */
	storage?: object;
}

// The config read by providers outside the faked ones (no .env file, no process.env lookup)
const TEST_ENV = {
	GOPODDER_URL: "",
	GOPODDER_USERNAME: "",
	GOPODDER_PASSWORD: "",
	STEAM_API_KEY: "",
	STEAM_ID: "",
	GOG_USERNAME: "",
	// no ScheduleModule in the test app either: the @Cron() methods never fire
	GAME_SYNC_SCHEDULER: "off",
};

export function makeFakeStorage() {
	return {
		put: vi.fn().mockResolvedValue({}),
		get: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue({}),
		signedDownloadUrl: vi.fn().mockResolvedValue("https://signed.example/file"),
	};
}

/**
 * Boots a Nest app with one feature module plus the real global enhancers (AuthModule's guard,
 * CommonModule's pipe and filter), the databases, S3 and better-auth replaced by fakes. No real DB.
 * Requests go through `app.inject()`.
 */
export async function buildTestApp(
	featureModule: Type,
	{
		mongoDb = makeFakeMongo().mongo.db,
		drizzle = makeFakeDrizzle().db,
		session = null,
		storage = makeFakeStorage(),
	}: TestAppOptions = {},
) {
	const moduleRef = await Test.createTestingModule({
		imports: [
			ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => TEST_ENV] }),
			featureModule,
			AuthModule,
			CommonModule,
		],
	})
		.overrideProvider(MONGO_DB)
		.useValue(mongoDb)
		// DatabaseModule's shutdown hook closes both clients
		.overrideProvider(MONGO_CLIENT)
		.useValue({ close: vi.fn() })
		.overrideProvider(DRIZZLE)
		.useValue({ ...drizzle, $client: { end: vi.fn() } })
		// StorageModule's shutdown hook destroys the client
		.overrideProvider(S3_CLIENT)
		.useValue({ destroy: vi.fn() })
		.overrideProvider(S3_BUCKET)
		.useValue("test-bucket")
		.overrideProvider(ObjectStorage)
		.useValue(storage)
		.overrideProvider(AUTH)
		// handler: better-auth's own routes (/auth/*), served by AuthHandlerMiddleware
		.useValue({ api: { getSession: vi.fn().mockResolvedValue(session) }, handler: vi.fn() })
		.compile();

	const app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter(), { logger: false });
	configureBodyParsers(app);
	await app.init();
	return app;
}
