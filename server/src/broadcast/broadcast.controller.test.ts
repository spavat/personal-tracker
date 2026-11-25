import type { NestNodeApplication } from "@nestjs/platform-node";

import { PgDialect } from "drizzle-orm/pg-core";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { broadcastEpisode, broadcastProgram, broadcastView } from "../database/schema.js";
import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { BroadcastModule } from "./broadcast.module.js";

const PROGRAM = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

// A query chain awaiting to `result`, whatever is called on it
function chainOf(result: unknown): Record<string, unknown> {
	const chain: Record<string, unknown> = new Proxy(() => {}, {
		get(_target, prop) {
			if (prop === "then") {
				return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
					Promise.resolve(result).then(resolve, reject);
			}
			return () => chain;
		},
		apply: () => chain,
	}) as unknown as Record<string, unknown>;
	return chain;
}

// The fake Drizzle's selects answer the rows given for the table they read (none by default), its writes
// `[{ id: PROGRAM }]`; the SQL of the `where` of each program read is kept
async function setup(session: unknown = OWNER, rows = new Map<unknown, unknown[]>()) {
	const { mongo, collection } = makeFakeMongo();
	const { db } = makeFakeDrizzle({ builderResult: [{ id: PROGRAM }] });
	const programWheres: string[] = [];
	db.select = vi.fn(() => ({
		from: (table: unknown) => {
			const chain = chainOf(rows.get(table) ?? []);
			if (table !== broadcastProgram) return chain;
			return new Proxy(chain, {
				get(target, key) {
					if (key !== "where") return Reflect.get(target, key);
					return (where: Parameters<PgDialect["sqlToQuery"]>[0] | undefined) => {
						programWheres.push(where ? new PgDialect().sqlToQuery(where).sql : "");
						return chain;
					};
				},
			});
		},
	})) as unknown as typeof db.select;
	const app = await buildTestApp(BroadcastModule, { mongoDb: mongo.db, drizzle: db, session });
	return { app, db, programWheres, sync: collection("broadcast_sync") };
}

// A program row without feed
const PROGRAM_ROW = {
	id: PROGRAM,
	name: "Prog",
	links: [],
	tags: [],
	private: false,
	rss: null,
	youtubeChannelId: null,
	youtubePlaylistId: null,
};

// An AntennaPod backup holding one listened episode, padded past the 100kb default body limit
function antennaPodBackup() {
	const dir = mkdtempSync(join(tmpdir(), "antennapod-test-"));
	try {
		const path = join(dir, "backup.db");
		const db = new DatabaseSync(path);
		db.exec(`
			CREATE TABLE Feeds (id INTEGER PRIMARY KEY, title TEXT, download_url TEXT);
			CREATE TABLE FeedItems (id INTEGER PRIMARY KEY, title TEXT, item_identifier TEXT, feed INTEGER);
			CREATE TABLE FeedMedia (id INTEGER PRIMARY KEY, feeditem INTEGER, duration INTEGER, played_duration INTEGER, playback_completion_date INTEGER);
			CREATE TABLE Padding (data BLOB);
			INSERT INTO Feeds VALUES (1, 'Prog', 'http://feed');
			INSERT INTO FeedItems VALUES (1, 'Episode 1', 'guid-1', 1);
			INSERT INTO FeedMedia VALUES (1, 1, 3600000, 1800000, 1790000000000);
		`);
		db.prepare("INSERT INTO Padding VALUES (?)").run(new Uint8Array(150 * 1024));
		db.close();
		return readFileSync(path);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("BroadcastModule controllers", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	describe("privacy", () => {
		it("hides the private programs from an anonymous visitor, through the request context", async () => {
			const ctx = await setup(null);
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/broadcast/programs" })).statusCode).toBe(200);

			expect(ctx.programWheres[0]).toContain(`"program"."private" = $1`);
		});

		it("shows everything to the owner", async () => {
			const ctx = await setup();
			app = ctx.app;

			await app.inject({ method: "GET", url: "/broadcast/programs" });

			expect(ctx.programWheres).toEqual([""]);
		});

		it("answers 404 to a visitor asking for a private program", async () => {
			({ app } = await setup(null));
			expect((await app.inject({ method: "GET", url: `/broadcast/programs/${PROGRAM}` })).statusCode).toBe(404);
		});
	});

	it("opens the lists and the stats to visitors, nothing else", async () => {
		({ app } = await setup(null));

		for (const url of [
			"/broadcast/episodes",
			`/broadcast/entities/${PROGRAM}`,
			"/broadcast/stats?from=2024-01-01&to=2024-01-31",
			"/broadcast/stats/fortnight",
		]) {
			expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(200);
		}
		for (const url of [
			"/broadcast/extract?url=x",
			"/broadcast/latest/" + PROGRAM,
			"/broadcast/review",
			"/broadcast/sync",
		]) {
			expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
		}
	});

	describe("validation", () => {
		it("rejects a non-uuid program id and non-uuid delete ids", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/broadcast/programs/nope" })).statusCode).toBe(400);
			expect((await app.inject({ method: "GET", url: "/broadcast/entities/nope" })).statusCode).toBe(400);
			expect(
				(await app.inject({ method: "DELETE", url: "/broadcast/programs/nope/episodes/nope" })).statusCode,
			).toBe(400);
		});

		it("rejects a program body without its program", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: "/broadcast/programs",
				payload: { episode: { name: "Ep" } },
			});

			expect(res.statusCode).toBe(400);
			expect(ctx.db.insert).not.toHaveBeenCalled();
		});

		it("rejects a proposal validated as both a new program and an episode of an existing one", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: `/broadcast/sync/33333333-3333-4333-8333-333333333333/validate`,
				payload: { program: { name: "Prog" }, programId: PROGRAM, episode: { name: "Ep" } },
			});

			expect(res.statusCode).toBe(400);
			expect(ctx.db.insert).not.toHaveBeenCalled();
		});

		it("rejects an episode created with neither a view nor the status planned, or with both", async () => {
			const ctx = await setup();
			app = ctx.app;
			const episode = { name: "Ep", duration: 10, type: "podcast" };
			const create = (payload: object) =>
				app.inject({ method: "POST", url: `/broadcast/programs/${PROGRAM}/episodes`, payload });

			expect((await create(episode)).statusCode).toBe(400);
			expect((await create({ ...episode, view: { date: "2026-10-01" }, status: "planned" })).statusCode).toBe(
				400,
			);
			expect(
				(
					await app.inject({
						method: "PUT",
						url: `/broadcast/programs/${PROGRAM}/episodes/${PROGRAM}/status`,
						payload: { status: "watched" },
					})
				).statusCode,
			).toBe(400);
			expect(ctx.db.insert).not.toHaveBeenCalled();
		});

		it("answers 400 to the latest episodes of a program without feed", async () => {
			({ app } = await setup(OWNER, new Map([[broadcastProgram, [PROGRAM_ROW]]])));

			expect((await app.inject({ method: "GET", url: `/broadcast/latest/${PROGRAM}` })).statusCode).toBe(400);
		});
	});

	describe("AntennaPod upload", () => {
		it("reads a raw SQLite backup larger than the default 100kb body limit", async () => {
			const ctx = await setup();
			app = ctx.app;
			const backup = antennaPodBackup();
			expect(backup.length).toBeGreaterThan(100 * 1024);

			const res = await app.inject({
				method: "POST",
				url: "/broadcast/sync/upload",
				headers: { "content-type": "application/octet-stream" },
				payload: backup,
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ count: 1 });
			const [proposals] = ctx.sync.insertMany.mock.calls[0] as unknown as [Array<{ listened: object }>];
			expect(proposals[0].listened).toMatchObject({
				episodeId: "guid-1",
				podcastUrl: "http://feed",
				percentListened: 50,
			});
		});

		it("answers 409 while a sync is in progress", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.sync.countDocuments.mockResolvedValue(3);

			const res = await app.inject({
				method: "POST",
				url: "/broadcast/sync/upload",
				headers: { "content-type": "application/octet-stream" },
				payload: Buffer.from("SQLite format 3"),
			});

			expect(res.statusCode).toBe(409);
			expect(ctx.sync.insertMany).not.toHaveBeenCalled();
		});
	});

	it("POST /sync/:id/validate saves the episode, then removes the proposal", async () => {
		// the fake's writes answer the id PROGRAM: the new episode has it, then reads back as this row
		const episodeRow = {
			episode: {
				id: PROGRAM,
				programId: PROGRAM,
				name: "Ep",
				duration: 30,
				type: "podcast",
				tags: [],
				ignoredTags: [],
			},
			view: null,
		};
		const ctx = await setup(
			OWNER,
			new Map<unknown, unknown[]>([
				[broadcastProgram, [PROGRAM_ROW]],
				[broadcastEpisode, [episodeRow]],
			]),
		);
		app = ctx.app;
		const proposal = "33333333-3333-4333-8333-333333333333";

		const res = await app.inject({
			method: "POST",
			url: `/broadcast/sync/${proposal}/validate`,
			payload: {
				programId: PROGRAM,
				episode: { name: "Ep", duration: 30, type: "podcast", tags: [], view: { date: "2026-10-01" } },
			},
		});

		expect(res.statusCode).toBe(200);
		expect(ctx.db.insert).toHaveBeenCalledWith(broadcastView);
		expect(ctx.sync.deleteOne).toHaveBeenCalledWith({ id: proposal });
	});
});
