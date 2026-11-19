import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { MusicModule } from "./music.module.js";

const UUID = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

const LISTENING = {
	id: UUID,
	listeningDate: "2024-06-01",
	artist: ["Rush"],
	album: "Moving Pictures",
	releaseDate: "1981",
	duration: 40,
	genre: "prog rock",
};

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(MusicModule, { mongoDb: mongo.db, session });
	return { app, listenings: collection("music_listening"), genres: collection("music_genre") };
}

describe("MusicModule controllers", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	describe("auth", () => {
		it("lets an anonymous visitor read the listenings and the stats", async () => {
			({ app } = await setup(null));

			for (const url of [
				"/music/list",
				"/music/search?search=rush",
				"/music/stats?from=2024-01-01&to=2024-01-31",
				"/music/fortnight-stats",
			]) {
				expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(200);
			}
		});

		it("keeps the genres, the reports and the writes for the owner", async () => {
			({ app } = await setup(null));

			expect((await app.inject({ method: "GET", url: "/music/genres" })).statusCode).toBe(401);
			expect(
				(await app.inject({ method: "GET", url: "/music/reports?from=2024-01-01&to=2024-01-31" })).statusCode,
			).toBe(401);
			expect((await app.inject({ method: "DELETE", url: `/music/${UUID}` })).statusCode).toBe(401);
		});
	});

	describe("validation", () => {
		it("rejects a non-uuid listening id", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/music/id?id=nope" })).statusCode).toBe(400);
		});
		it("rejects an incomplete genre save", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "POST", url: "/music/genres/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects an incomplete listening save", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "POST", url: "/music/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects a non-uuid delete id", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "DELETE", url: "/music/nope" })).statusCode).toBe(400);
		});
		it("requires the stats period", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/music/stats" })).statusCode).toBe(400);
		});
	});

	describe("listenings", () => {
		it("GET /list strips the fields outside the response schema", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.listenings.find.mockReturnValueOnce(makeCursor([{ ...LISTENING, created: "2024-06-01T10:00:00" }]));

			const res = await app.inject({ method: "GET", url: "/music/list" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([LISTENING]);
		});

		it("GET /search aggregates listenings", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/music/search?search=rush" })).statusCode).toBe(200);
			expect(ctx.listenings.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /id loads one listening without its Mongo _id", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.listenings.findOne.mockResolvedValueOnce({ _id: "mongo-id", ...LISTENING });

			const res = await app.inject({ method: "GET", url: `/music/id?id=${UUID}` });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual(LISTENING);
			expect(ctx.listenings.findOne).toHaveBeenCalledWith({ id: UUID });
		});

		it("GET /id 404s for an unknown listening", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "GET", url: `/music/id?id=${UUID}` });

			expect(res.statusCode).toBe(404);
			expect(res.json()).toMatchObject({ message: "Écoute introuvable" });
		});

		it("POST /save inserts a new listening", async () => {
			const ctx = await setup();
			app = ctx.app;
			const { id, ...body } = LISTENING;

			const res = await app.inject({ method: "POST", url: "/music/save", payload: body });

			expect(res.statusCode).toBe(200);
			expect(ctx.listenings.insertOne).toHaveBeenCalledTimes(1);
		});

		it("DELETE /:id removes a listening by id", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "DELETE", url: `/music/${UUID}` });

			expect(res.statusCode).toBe(200);
			expect(ctx.listenings.deleteOne).toHaveBeenCalledWith({ id: UUID });
		});
	});

	describe("genres", () => {
		it("GET /genres lists the genre groups", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/music/genres" })).statusCode).toBe(200);
			expect(ctx.genres.find).toHaveBeenCalledTimes(1);
		});

		it("POST /genres/save inserts a new genre group", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: "/music/genres/save",
				payload: { name: "Rock", genres: ["prog rock"] },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.genres.insertOne).toHaveBeenCalledTimes(1);
		});

		it("DELETE /genres/:id removes a genre group, not a listening", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "DELETE", url: `/music/genres/${UUID}` });

			expect(res.statusCode).toBe(200);
			expect(ctx.genres.deleteOne).toHaveBeenCalledWith({ id: UUID });
			expect(ctx.listenings.deleteOne).not.toHaveBeenCalled();
		});
	});
});
