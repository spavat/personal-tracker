import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle";
import { makeCursor, makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import homeRoutes from "./home.routes";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(homeRoutes, { mongo, db });
	return { app, collection, db };
}

// a book row as loaded by BookRepository, with one reading on the given dates
function bookRow(id: string, title: string, dates: string[]) {
	return {
		id,
		title,
		country: "fr",
		contributors: [],
		editions: [
			{
				language: "fr",
				pages: null,
				model: null,
				readings: [
					{
						id: `${id}-r`,
						status: "complete",
						entries: dates.map((date) => ({ chapterId: "c1", date, tags: [] })),
					},
				],
			},
		],
	};
}

function pipelineOf(collection: ReturnType<typeof makeFakeMongo>["collection"], name: string) {
	return (collection(name).aggregate.mock.calls[0] as any)[0] as Record<string, unknown>[];
}

describe("home routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /latest returns empty lists when nothing was done", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			game: [],
			show: [],
			music: [],
			internet: [],
			"reading-manga": [],
			"reading-book": [],
		});
	});

	it("GET /latest asks each domain for its most recent items, limited", async () => {
		await ctx.app.inject({ method: "GET", url: "/latest" });

		expect(pipelineOf(ctx.collection, "game")).toEqual(
			expect.arrayContaining([{ $sort: { latestRealPlayDate: -1, latestCreatedDate: -1 } }, { $limit: 3 }]),
		);
		expect(pipelineOf(ctx.collection, "reading_manga")).toEqual(
			expect.arrayContaining([{ $sort: { lastReadingDate: -1, latestReadingCreated: -1 } }, { $limit: 6 }]),
		);
		expect((ctx.db.query as any).readingBook.findMany).toHaveBeenCalled();
		expect(pipelineOf(ctx.collection, "internet")).toEqual(
			expect.arrayContaining([
				{ $unwind: "$episodes" },
				{ $sort: { "episodes.date": -1, "episodes.created": -1 } },
				{ $limit: 6 },
			]),
		);
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

	it("GET /latest keeps the 6 books read last", async () => {
		(ctx.db.query as any).readingBook.findMany.mockResolvedValue(
			["01", "07", "03", "05", "02", "06", "04"].map((day) => bookRow(`b${day}`, day, [`2026-10-${day}`])),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.json()["reading-book"].map((book: { id: string }) => book.id)).toEqual([
			"b07",
			"b06",
			"b05",
			"b04",
			"b03",
			"b02",
		]);
	});

	it("GET /latest keeps the game plays, without the catch-ups", async () => {
		await ctx.app.inject({ method: "GET", url: "/latest" });

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

		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.json().game[0].header).toBe("/images/game/g1/header");
	});

	it("GET /latest maps the listenings", async () => {
		ctx.collection("music_listening").find.mockReturnValue(
			makeCursor([
				{ id: "l1", artist: ["Radiohead"], album: "OK Computer", listeningDate: "2026-11-10", duration: 53 },
			]),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.json().music).toEqual([
			{ id: "l1", artist: ["Radiohead"], album: "OK Computer", date: "2026-11-10" },
		]);
	});

	it("GET /latest groups the latest episodes by program, latest program first", async () => {
		await ctx.app.inject({ method: "GET", url: "/latest" });

		const pipeline = pipelineOf(ctx.collection, "internet");
		const limitAt = pipeline.findIndex((stage) => "$limit" in stage);
		const groupAt = pipeline.findIndex((stage) => "$group" in stage);
		// limited on the episodes, before grouping them
		expect(limitAt).toBeLessThan(groupAt);
		expect(pipeline[groupAt]).toHaveProperty("$group._id", "$id");
		expect(pipeline[groupAt + 1]).toEqual({ $sort: { latestEpisodeDate: -1, latestEpisodeCreated: -1 } });
	});

	it("GET /latest serves the program profile through the image proxy, not its S3 key", async () => {
		ctx.collection("internet").aggregate.mockReturnValue(
			makeCursor([
				{
					id: "p1",
					name: "Le Masque",
					profile: "personal-tracker/internet/p1.profile.avif",
					episodes: [{ id: "e1", name: "Épisode", date: "2026-11-11", duration: 60 }],
				},
			]),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.json().internet).toEqual([
			{
				id: "p1",
				name: "Le Masque",
				profile: "/images/internet/p1.profile",
				episodes: [{ id: "e1", name: "Épisode", date: "2026-11-11", duration: 60 }],
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
		(ctx.db.query as any).readingBook.findMany.mockResolvedValue([
			bookRow("b1", "Lu", ["2026-10-01"]),
			bookRow("b2", "Jamais lu", []),
		]);

		const res = await ctx.app.inject({ method: "GET", url: "/latest" });
		expect(res.json().game.map((game: { id: string }) => game.id)).toEqual(["g1"]);
		expect(res.json()["reading-manga"]).toEqual([]);
		expect(res.json()["reading-book"].map((book: { id: string }) => book.id)).toEqual(["b1"]);
	});
});
