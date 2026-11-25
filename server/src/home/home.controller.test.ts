import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { BroadcastRepository } from "../broadcast/broadcast.repository.js";
import { BookRepository } from "../reading-book/book.repository.js";
import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { makeCursor, makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { HomeModule } from "./home.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const { db } = makeFakeDrizzle();
	const app = await buildTestApp(HomeModule, { mongoDb: mongo.db, drizzle: db, session: OWNER });
	return { app, collection, db };
}

function pipelineOf(collection: ReturnType<typeof makeFakeMongo>["collection"], name: string) {
	return (collection(name).aggregate.mock.calls[0] as any)[0] as Record<string, unknown>[];
}

describe("home routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	let findBooks: MockInstance<BookRepository["findAll"]>;
	let findLatestEpisodes: MockInstance<BroadcastRepository["findLatestEpisodes"]>;

	beforeEach(async () => {
		findBooks = vi.spyOn(BookRepository.prototype, "findAll").mockResolvedValue([]);
		findLatestEpisodes = vi.spyOn(BroadcastRepository.prototype, "findLatestEpisodes").mockResolvedValue([]);
		ctx = await buildApp();
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		await ctx.app.close();
	});

	it("GET /latest returns empty lists when nothing was done", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/home/latest" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			game: [],
			show: [],
			music: [],
			broadcast: [],
			"reading-manga": [],
			"reading-book": [],
		});
	});

	it("GET /latest asks each domain for its most recent items, limited", async () => {
		await ctx.app.inject({ method: "GET", url: "/home/latest" });

		expect(pipelineOf(ctx.collection, "game")).toEqual(
			expect.arrayContaining([{ $sort: { latestRealPlayDate: -1, latestCreatedDate: -1 } }, { $limit: 3 }]),
		);
		expect(pipelineOf(ctx.collection, "reading_manga")).toEqual(
			expect.arrayContaining([{ $sort: { lastReadingDate: -1, latestReadingCreated: -1 } }, { $limit: 6 }]),
		);
		expect(findBooks).toHaveBeenCalledWith({
			withReadingsDetails: false,
			sortField: "lastReadDate",
			sortDirection: "desc",
			limit: 6,
		});
		expect(findLatestEpisodes).toHaveBeenCalledWith(6);
		expect(ctx.collection("music_listening").find).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ sort: { listeningDate: -1, created: -1 }, limit: 10 }),
		);
		expect((ctx.db.query as any).showPerformance.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ canceled: false }),
				orderBy: { date: "desc" },
				limit: 6,
			}),
		);
	});

	it("GET /latest keeps the game plays, without the catch-ups", async () => {
		await ctx.app.inject({ method: "GET", url: "/home/latest" });

		const pipeline = pipelineOf(ctx.collection, "game");
		expect(pipeline).not.toContainEqual({ $project: { _id: 0, plays: 0 } });
		expect(pipeline.at(-1)).toHaveProperty("$set.plays.$filter.cond", {
			$eq: [{ $type: "$$play.catchUp" }, "missing"],
		});
	});

	it("GET /latest serves the game pictures through the image proxy, not their S3 key", async () => {
		ctx.collection("game").aggregate.mockReturnValue(
			makeCursor([
				{
					id: "g1",
					name: "Hades",
					latestRealPlayDate: "2026-11-09",
					plays: [],
					header: "personal-tracker/game/g1.header.avif",
				},
			]),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/home/latest" });
		expect(res.json().game[0].header).toBe("/images/game/g1/header");
	});

	it("GET /latest maps the listenings", async () => {
		ctx.collection("music_listening").find.mockReturnValue(
			makeCursor([
				{ id: "l1", artist: ["Radiohead"], album: "OK Computer", listeningDate: "2026-11-10", duration: 53 },
			]),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/home/latest" });
		expect(res.json().music).toEqual([
			{ id: "l1", artist: ["Radiohead"], album: "OK Computer", date: "2026-11-10" },
		]);
	});

	it("GET /latest serves the program profile through the image proxy, not its S3 key", async () => {
		findLatestEpisodes.mockResolvedValue([
			{
				id: "p1",
				name: "Le Masque",
				tracking: "feed",
				credits: [],
				profile: "personal-tracker/broadcast/p1.profile.avif",
				episodes: [
					{
						id: "e1",
						name: "Épisode",
						duration: 60,
						type: "podcast",
						credits: [],
						views: [{ id: "v1", date: "2026-11-11" }],
					},
				],
			},
		]);

		const res = await ctx.app.inject({ method: "GET", url: "/home/latest" });
		expect(res.json().broadcast).toEqual([
			{
				id: "p1",
				name: "Le Masque",
				tracking: "feed",
				credits: [],
				profile: "/images/broadcast/p1.profile",
				episodes: [
					{
						id: "e1",
						name: "Épisode",
						duration: 60,
						type: "podcast",
						credits: [],
						views: [{ id: "v1", date: "2026-11-11" }],
					},
				],
			},
		]);
	});

	it("GET /latest leaves out the games never played and the mangas / books never read", async () => {
		ctx.collection("game").aggregate.mockReturnValue(
			makeCursor([
				{ id: "g1", name: "Hades", latestRealPlayDate: "2026-11-09", plays: [] },
				{ id: "g2", name: "Jamais joué", latestRealPlayDate: null, plays: [] },
			]),
		);
		ctx.collection("reading_manga").aggregate.mockReturnValue(
			makeCursor([{ id: "m1", title: "Jamais lu", lastReadingDate: null }]),
		);
		findBooks.mockResolvedValue([
			{ id: "b1", book: "Lu", lastReadDate: "2026-10-01", readings: [] },
			{ id: "b2", book: "Jamais lu", lastReadDate: null, readings: [] },
		] as any);

		const res = await ctx.app.inject({ method: "GET", url: "/home/latest" });
		expect(res.json().game.map((game: { id: string }) => game.id)).toEqual(["g1"]);
		expect(res.json()["reading-manga"]).toEqual([]);
		expect(res.json()["reading-book"].map((book: { id: string }) => book.id)).toEqual(["b1"]);
	});
});
