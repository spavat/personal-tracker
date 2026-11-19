// Checks the stored documents and rows against the response schemas, before deploying a route that serializes them:
// a document the schema refuses answers a 500. Prints each refused one with its issues, exits 1 when there is one.
// Usage, from server/ after a build: npm run check-stored-data (in production: docker compose exec server npm run check-stored-data)
import type { PgTable } from "drizzle-orm/pg-core";

import { GameSchema } from "@personal-tracker/shared/game";
import { ProgramSchema } from "@personal-tracker/shared/internet";
import { LifespanObjectSchema } from "@personal-tracker/shared/lifespan";
import {
	AccountHistorySchema,
	AccountSchema,
	BankSchema,
	CategorySchema,
	PaymentTypeSchema,
	TagSchema,
	TransactionRowSchema,
} from "@personal-tracker/shared/money";
import { MusicGenreSchema } from "@personal-tracker/shared/music";
import { MangaSchema } from "@personal-tracker/shared/reading-manga";
import {
	ArtistSchema,
	ModelSchema,
	PerformanceSchema,
	PlaceSchema,
	SpectacleSchema,
	WorkSchema,
} from "@personal-tracker/shared/show";
import { MongoClient } from "mongodb";
import * as z from "zod";

import { envSchema } from "../config/env.schema.js";
import { createDrizzle } from "../database/drizzle.js";
import {
	moneyAccount,
	moneyAccountHistory,
	moneyBank,
	moneyCategory,
	moneyPaymentType,
	moneyTag,
	moneyTransaction,
	showArtist,
	showModel,
	showPerformance,
	showPlace,
	showSpectacle,
	showWork,
} from "../database/schema.js";

// Mongo collection -> the schema each of its documents is answered with
const COLLECTIONS: Array<[collection: string, schema: z.ZodType]> = [
	["internet", ProgramSchema],
	["reading_manga", MangaSchema],
	["lifespan_object", LifespanObjectSchema],
	["game", GameSchema],
	["music_genre", MusicGenreSchema],
];
// PostgreSQL table -> the schema of its rows (the relations are checked through their own table)
const TABLES: Array<[name: string, table: PgTable, schema: z.ZodType]> = [
	["money.account", moneyAccount, AccountSchema],
	["money.account_history", moneyAccountHistory, AccountHistorySchema],
	["money.bank", moneyBank, BankSchema],
	["money.category", moneyCategory, CategorySchema],
	["money.payment_type", moneyPaymentType, PaymentTypeSchema],
	["money.tag", moneyTag, TagSchema],
	["money.transaction", moneyTransaction, TransactionRowSchema],
	["show.artist", showArtist, ArtistSchema],
	["show.model", showModel, ModelSchema.omit({ roles: true })],
	["show.performance", showPerformance, PerformanceSchema],
	["show.place", showPlace, PlaceSchema],
	["show.spectacle", showSpectacle, SpectacleSchema],
	["show.work", showWork, WorkSchema],
];

const { MONGODB_URL, DATABASE_URL } = envSchema.pick({ MONGODB_URL: true, DATABASE_URL: true }).parse(process.env);

let refused = 0;
function check(source: string, items: Array<Record<string, unknown>>, schema: z.ZodType) {
	for (const item of items) {
		const result = schema.safeParse(item);
		if (!result.success) {
			refused++;
			console.log(`${source} ${item.id} (${item.name ?? item.title ?? ""}):`);
			for (const issue of result.error.issues) {
				console.log(`  ${issue.path.join(".")}: ${issue.message}`);
			}
		}
	}
	console.log(`${source}: ${items.length} checked`);
}

const client = new MongoClient(MONGODB_URL);
try {
	for (const [collection, schema] of COLLECTIONS) {
		const documents = await client
			.db()
			.collection(collection)
			.find({}, { projection: { _id: 0 } })
			.toArray();
		check(collection, documents, schema);
	}
} finally {
	await client.close();
}

const db = createDrizzle(DATABASE_URL);
try {
	for (const [name, table, schema] of TABLES) {
		check(name, await db.select().from(table), schema);
	}
} finally {
	await db.$client.end();
}

console.log(refused ? `${refused} refused` : "everything passes");
process.exit(refused ? 1 : 0);
