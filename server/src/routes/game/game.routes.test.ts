import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import gameRoutes from "./game.routes";

const GAME_UUID = "11111111-1111-4111-8111-111111111111";
const PLAY_UUID = "22222222-2222-4222-8222-222222222222";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(gameRoutes, { mongo });
	return { app, games: collection("game") };
}

describe("game routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid game id", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/games/not-a-uuid" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a save body that is neither a game nor a play+gameId", async () => {
			const res = await ctx.app.inject({ method: "POST", url: "/save", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects non-uuid delete ids", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: "/games/nope/plays/nope" });
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /games runs the overview aggregation", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/games" });
			expect(res.statusCode).toBe(200);
			expect(ctx.games.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /plays runs the plays aggregation", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/plays" });
			expect(res.statusCode).toBe(200);
			expect(ctx.games.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /games/:id loads the game by id", async () => {
			ctx.games.findOne.mockResolvedValueOnce({ id: GAME_UUID, name: "Celeste", plays: [] });

			const res = await ctx.app.inject({ method: "GET", url: `/games/${GAME_UUID}` });

			expect(res.statusCode).toBe(200);
			expect(ctx.games.findOne).toHaveBeenCalledWith({ id: GAME_UUID });
			expect(res.json()).toEqual({ id: GAME_UUID, name: "Celeste", plays: [] });
		});

		it("POST /save inserts a new game", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { game: { name: "Celeste", developper: "EMH", editor: "EMH" } },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.games.insertOne).toHaveBeenCalledTimes(1);
			expect(ctx.games.insertOne.mock.calls[0][0]).toMatchObject({ name: "Celeste", plays: [] });
		});

		it("DELETE /games/:gameId/plays/:playId pulls the play from the game", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/games/${GAME_UUID}/plays/${PLAY_UUID}`,
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.games.updateOne).toHaveBeenCalledWith(
				{ id: GAME_UUID },
				{ $pull: { plays: { id: PLAY_UUID } } },
			);
		});
	});
});
