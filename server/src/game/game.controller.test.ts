import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { GameModule } from "./game.module.js";

const GAME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(GameModule, { mongoDb: mongo.db, session });
	return { app, games: collection("game"), snapshots: collection("game_sync_snapshot") };
}

describe("GameModule controllers", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("opens the game lists and details to visitors, not the writes nor the sync", async () => {
		({ app } = await setup(null));

		expect((await app.inject({ method: "GET", url: "/game/games" })).statusCode).toBe(200);
		expect((await app.inject({ method: "GET", url: "/game/plays" })).statusCode).toBe(200);
		expect((await app.inject({ method: "POST", url: "/game/games", payload: {} })).statusCode).toBe(401);
		expect((await app.inject({ method: "GET", url: "/game/sync/status" })).statusCode).toBe(401);
	});

	it("GET /games/:id answers 404 for an unknown game", async () => {
		({ app } = await setup());
		expect((await app.inject({ method: "GET", url: `/game/games/${GAME}` })).statusCode).toBe(404);
	});

	it("rejects a game body without its game", async () => {
		const ctx = await setup();
		app = ctx.app;

		const res = await app.inject({ method: "POST", url: "/game/games", payload: { play: { date: "2026-11-01" } } });

		expect(res.statusCode).toBe(400);
		expect(ctx.games.insertOne).not.toHaveBeenCalled();
	});

	it("POST /games/:gameId/plays answers 201 with the play, 404 for an unknown game", async () => {
		const ctx = await setup();
		app = ctx.app;
		const url = `/game/games/${GAME}/plays`;

		const res = await app.inject({ method: "POST", url, payload: { date: "2026-11-01", duration: 30 } });
		expect(res.statusCode).toBe(201);
		expect(res.json()).toMatchObject({ id: expect.any(String), date: "2026-11-01", duration: 30 });

		ctx.games.updateOne.mockResolvedValueOnce({ acknowledged: true, matchedCount: 0, modifiedCount: 0 });
		expect((await app.inject({ method: "POST", url, payload: { date: "2026-11-01" } })).statusCode).toBe(404);
	});

	it("DELETE /games/:gameId/plays/:playId pulls the play", async () => {
		const ctx = await setup();
		app = ctx.app;

		const res = await app.inject({ method: "DELETE", url: `/game/games/${GAME}/plays/${OTHER}` });

		expect(res.statusCode).toBe(204);
		expect(ctx.games.updateOne).toHaveBeenCalledWith(
			{ id: GAME, "plays.id": OTHER },
			{ $pull: { plays: { id: OTHER } } },
		);
	});

	describe("sync", () => {
		it("GET /sync/status reports each store, none configured here", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "GET", url: "/game/sync/status" });

			expect(res.statusCode).toBe(200);
			expect(
				res.json().stores.map((s: { store: string; configured: boolean }) => [s.store, s.configured]),
			).toEqual([
				["steam", false],
				["gog", false],
				["epic", false],
			]);
		});

		it("rejects an unknown store with 400", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "POST", url: "/game/sync/import/itch/preview" })).statusCode).toBe(400);
		});

		it("answers 502 to an import of a store that isn't configured", async () => {
			({ app } = await setup());
			const res = await app.inject({ method: "POST", url: "/game/sync/import/steam/preview" });
			expect(res.statusCode).toBe(502);
			expect(res.json().message).toBe("steam n'est pas configuré");
		});

		it("POST /sync/run skips the stores that aren't configured", async () => {
			({ app } = await setup());
			const res = await app.inject({ method: "POST", url: "/game/sync/run" });
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([]);
		});

		it("answers 400 to a replay of a day no snapshot covers", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "POST", url: "/game/sync/replay/steam/2020-01-01" })).statusCode).toBe(
				400,
			);
		});

		it("merge answers 400 for a game merged with itself, 404 for an unknown one", async () => {
			({ app } = await setup());

			const self = await app.inject({
				method: "POST",
				url: "/game/sync/merge",
				payload: { keepId: GAME, removeId: GAME },
			});
			const unknown = await app.inject({
				method: "POST",
				url: "/game/sync/merge",
				payload: { keepId: GAME, removeId: OTHER },
			});

			expect(self.statusCode).toBe(400);
			expect(unknown.statusCode).toBe(404);
		});
	});
});
