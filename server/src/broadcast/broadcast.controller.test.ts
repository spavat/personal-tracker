import type { NestNodeApplication } from "@nestjs/platform-node";

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { BroadcastModule } from "./broadcast.module.js";

const PROGRAM = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(BroadcastModule, { mongoDb: mongo.db, session });
	return { app, programs: collection("broadcast"), sync: collection("broadcast_sync") };
}

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

			const [pipeline] = ctx.programs.aggregate.mock.calls[0] as unknown as [Array<{ $match?: object }>];
			expect(pipeline[0].$match).toMatchObject({ private: { $ne: true } });
		});

		it("shows everything to the owner", async () => {
			const ctx = await setup();
			app = ctx.app;

			await app.inject({ method: "GET", url: "/broadcast/programs" });

			const [pipeline] = ctx.programs.aggregate.mock.calls[0] as unknown as [Array<{ $match?: object }>];
			expect(pipeline[0].$match).not.toHaveProperty("private");
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
			expect(ctx.programs.insertOne).not.toHaveBeenCalled();
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
			expect(ctx.programs.insertOne).not.toHaveBeenCalled();
		});

		it("answers 400 to the latest episodes of a program without feed", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.programs.findOne.mockResolvedValueOnce({ id: PROGRAM, refs: {}, episodes: [] });

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
		const ctx = await setup();
		app = ctx.app;
		const proposal = "33333333-3333-4333-8333-333333333333";

		const res = await app.inject({
			method: "POST",
			url: `/broadcast/sync/${proposal}/validate`,
			payload: {
				programId: PROGRAM,
				episode: { name: "Ep", duration: 30, date: "2026-10-01", type: "podcast", tags: [], contextTags: [] },
			},
		});

		expect(res.statusCode).toBe(200);
		expect(ctx.programs.updateOne).toHaveBeenCalledWith(
			{ id: PROGRAM },
			{ $push: { episodes: expect.objectContaining({ name: "Ep" }) } },
		);
		expect(ctx.sync.deleteOne).toHaveBeenCalledWith({ id: proposal });
	});
});
