import { inArray, sql } from "drizzle-orm";
import { MongoClient } from "mongodb";

// One-off (ticket 03 of .scratch/broadcast-postgres): copies the Mongo `broadcast` collection into the Postgres
// `broadcast` schema, in one transaction. Mongo is left untouched: the app reads it until ticket 04.
// Refuses to run when broadcast.program already has rows, or when episodes of a program share an externalId with
// different titles (listed, to fix by hand first). --dry-run does every write then rolls back.
// Usage, from server/ after a build: npm run migrate-broadcast [-- --dry-run]
import type { MongoProgram } from "./broadcast-migration.utils.js";

import { envSchema } from "../config/env.schema.js";
import { createDrizzle } from "../database/drizzle.js";
import { createEntity, type EntityKind, type Tx } from "../database/node.query.js";
import {
	broadcastEpisode,
	broadcastProgram,
	broadcastProgramContributor,
	broadcastView,
	coreEntity,
	coreNode,
} from "../database/schema.js";
import { type CreditRow, toBroadcastRows } from "./broadcast-migration.utils.js";

const CHUNK = 1000;
const dryRun = process.argv.includes("--dry-run");
const env = envSchema.pick({ DATABASE_URL: true, MONGODB_URL: true }).parse(process.env);

class DryRun extends Error {}

const mongo = new MongoClient(env.MONGODB_URL);
const documents = await mongo
	.db()
	.collection<MongoProgram>("broadcast")
	.find({}, { projection: { _id: 0 } })
	.toArray()
	.finally(() => mongo.close());

const rows = toBroadcastRows(documents);
if (rows.conflicts.length) {
	console.error(`${rows.conflicts.length} externalId(s) shared by different episodes, to fix by hand first:`);
	for (const { programName, externalId, episodes } of rows.conflicts) {
		console.error(`- ${programName}, externalId ${externalId}`);
		for (const { id, date, name } of episodes) console.error(`    ${date} ${id} ${name}`);
	}
	process.exit(1);
}

// PostgreSQL takes at most 65535 parameters per statement
function chunks<T>(values: T[]) {
	return Array.from({ length: Math.ceil(values.length / CHUNK) }, (_, i) => values.slice(i * CHUNK, (i + 1) * CHUNK));
}

// Same key as the entity search: case and accents ignored
const nameKey = (name: string) =>
	name
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

// The entity of each credited name: an existing one of the same kind and name, else a new one
async function resolveEntities(tx: Tx, credits: CreditRow[]) {
	const ids = new Map<string, string>();
	const key = (kind: EntityKind, name: string) => `${kind}|${nameKey(name)}`;
	const existing = await tx
		.select({
			id: coreEntity.id,
			kind: coreEntity.kind,
			name: coreEntity.name,
			key: sql<string>`unaccent(lower(${coreEntity.name}))`,
		})
		.from(coreEntity)
		.where(
			inArray(
				coreEntity.kind,
				credits.map(({ kind }) => kind),
			),
		);
	for (const entity of existing) ids.set(`${entity.kind}|${entity.key}`, entity.id);
	const created: Array<{ kind: EntityKind; name: string }> = [];
	// credited name -> the existing entity it is given to
	const reused = new Map<string, string>();
	for (const { kind, name } of credits) {
		const k = key(kind, name);
		const id = ids.get(k);
		if (id) {
			const entity = existing.find((candidate) => candidate.id === id);
			if (entity) reused.set(`${kind} ${name}`, entity.name);
			continue;
		}
		ids.set(k, (await createEntity(tx, { kind, name })).id);
		created.push({ kind, name });
	}
	return { entityOf: (credit: CreditRow) => ids.get(key(credit.kind, credit.name))!, created, reused };
}

const db = createDrizzle(env.DATABASE_URL);
try {
	await db.transaction(async (tx) => {
		if ((await tx.select({ id: broadcastProgram.id }).from(broadcastProgram).limit(1)).length) {
			throw new Error("broadcast.program already has rows: already migrated");
		}

		const entities = await resolveEntities(tx, rows.credits);

		const nodes = [
			...rows.programs.map(({ id, name }) => ({ id, type: "program" as const, label: name })),
			...rows.episodes.map(({ id, name }) => ({ id, type: "episode" as const, label: name })),
		];
		for (const part of chunks(nodes)) await tx.insert(coreNode).values(part);
		for (const part of chunks(rows.programs)) await tx.insert(broadcastProgram).values(part);
		// two names of one program can resolve to the same entity (case or accents only differ)
		const contributors = [
			...new Map(
				rows.credits.map((credit) => {
					const row = {
						programId: credit.programId,
						entityId: entities.entityOf(credit),
						role: credit.role,
						order: credit.order,
					};
					return [`${row.programId}|${row.entityId}|${row.role}`, row];
				}),
			).values(),
		];
		for (const part of chunks(contributors)) await tx.insert(broadcastProgramContributor).values(part);
		for (const part of chunks(rows.episodes)) await tx.insert(broadcastEpisode).values(part);
		for (const part of chunks(rows.views)) await tx.insert(broadcastView).values(part);

		console.log(
			[
				`${documents.length} program(s), ${documents.reduce((n, p) => n + (p.episodes?.length ?? 0), 0)} Mongo episode(s)`,
				`-> ${rows.programs.length} program(s), ${rows.episodes.length} episode(s), ${rows.views.length} view(s)`,
				`   ${rows.merged} listening(s) merged into an earlier one of the same release`,
				`   ${rows.credits.length} credit(s): ${entities.created.length} entit(ies) created, ${entities.reused.size} existing reused`,
			].join("\n"),
		);
		if (dryRun) {
			console.log("\nentities created:");
			for (const { kind, name } of entities.created.toSorted(
				(a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
			)) {
				console.log(`  ${kind}\t${name}`);
			}
			console.log("existing entities reused:");
			for (const [credited, existing] of entities.reused) console.log(`  ${credited} -> ${existing}`);
			throw new DryRun();
		}
	});
	console.log("done");
} catch (error) {
	if (!(error instanceof DryRun)) throw error;
	console.log("dry run: rolled back");
} finally {
	await db.$client.end();
}
