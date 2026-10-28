import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import musicRoutes from "./music.routes";

const UUID = "11111111-1111-4111-8111-111111111111";

const LISTENING = {
	id: UUID,
	listeningDate: "2024-06-01",
	artist: ["Rush"],
	album: "Moving Pictures",
	releaseDate: "1981",
	duration: 40,
	genre: "prog rock",
};

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(musicRoutes, { mongo });
	return { app, listenings: collection("music_listening"), genres: collection("music_genre") };
}

describe("music routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid listening id", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/id?id=nope" })).statusCode).toBe(400);
		});
		it("rejects an incomplete genre save", async () => {
			expect((await ctx.app.inject({ method: "POST", url: "/genres/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects an incomplete listening save", async () => {
			expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects a non-uuid delete id", async () => {
			expect((await ctx.app.inject({ method: "DELETE", url: "/nope" })).statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /list queries listenings", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/list" })).statusCode).toBe(200);
			expect(ctx.listenings.find).toHaveBeenCalledTimes(1);
		});

		it("GET /search aggregates listenings", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/search?search=rush" })).statusCode).toBe(200);
			expect(ctx.listenings.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /id loads one listening by id", async () => {
			ctx.listenings.findOne.mockResolvedValueOnce(LISTENING);
			const res = await ctx.app.inject({ method: "GET", url: `/id?id=${UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.listenings.findOne).toHaveBeenCalledWith({ id: UUID });
		});

		it("GET /genres lists genre groups", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/genres" })).statusCode).toBe(200);
			expect(ctx.genres.find).toHaveBeenCalledTimes(1);
		});

		it("POST /genres/save inserts a new genre group", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/genres/save",
				payload: { name: "Rock", genres: ["prog rock"] },
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.genres.insertOne).toHaveBeenCalledTimes(1);
		});

		it("DELETE /genres/:id removes a genre group", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: `/genres/${UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.genres.deleteOne).toHaveBeenCalledWith({ id: UUID });
		});

		it("POST /save inserts a new listening", async () => {
			const { id, ...body } = LISTENING;
			const res = await ctx.app.inject({ method: "POST", url: "/save", payload: body });
			expect(res.statusCode).toBe(200);
			expect(ctx.listenings.insertOne).toHaveBeenCalledTimes(1);
		});

		it("DELETE /:id removes a listening by id", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: `/${UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.listenings.deleteOne).toHaveBeenCalledWith({ id: UUID });
		});
	});
});
