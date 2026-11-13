import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeCursor, makeFakeMongo } from "../../../test-support/fake-mongo";
import { buildRouteApp } from "../../../test-support/route-harness";
import syncRoutes from "./sync.routes";

// no store account, whatever server/.env holds
vi.mock("../../../config/game-stores", () => ({ STEAM_API_KEY: "", STEAM_ID: "", GOG_USERNAME: "" }));

const KEEP_UUID = "11111111-1111-4111-8111-111111111111";
const REMOVE_UUID = "22222222-2222-4222-8222-222222222222";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(syncRoutes, { mongo });
	return {
		app,
		games: collection("game"),
		snapshots: collection("game_sync_snapshot"),
		credentials: collection("game_sync_credential"),
	};
}

describe("game sync routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /status reports each store, the duplicates and the last failure, without writing", async () => {
		ctx.games.find.mockReturnValue(
			makeCursor([
				{ id: KEEP_UUID, name: "Brotato", storeIds: { steam: "1942280" }, plays: [] },
				{ id: REMOVE_UUID, name: "brotato", storeIds: { epic: "e8bbb84b" }, plays: [] },
				{ id: "33333333-3333-4333-8333-333333333333", name: "Hades", plays: [] },
			]),
		);
		ctx.credentials.findOne.mockResolvedValue({
			_id: "epic",
			accountId: "a",
			refreshToken: "r",
			refreshExpiresAt: "2027-11-13T15:40:27.755Z",
		});
		ctx.snapshots.find.mockImplementation(((query: { store: string }) =>
			makeCursor(
				query.store === "epic"
					? [
							{
								id: "s1",
								store: "epic",
								kind: "run",
								fetchedAt: "2026-11-14T03:00:00Z",
								day: "2026-11-13",
								status: "error",
								error: "Epic : erreur 401",
							},
						]
					: [],
			)) as never);

		const res = await ctx.app.inject({ method: "GET", url: "/status" });

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.stores.map((s: any) => [s.store, s.configured, s.linkedGames])).toEqual([
			["steam", false, 1],
			["gog", false, 0],
			["epic", true, 1],
		]);
		expect(body.stores[2]).toMatchObject({
			tokenExpiresAt: "2027-11-13T15:40:27.755Z",
			snapshots: [{ id: "s1", status: "error", error: "Epic : erreur 401" }],
		});
		expect(body.duplicates).toEqual([
			[
				{ id: KEEP_UUID, name: "Brotato", storeIds: { steam: "1942280" } },
				{ id: REMOVE_UUID, name: "brotato", storeIds: { epic: "e8bbb84b" } },
			],
		]);
		expect(body.lastRunFailed).toBe(true);
		for (const collection of [ctx.games, ctx.snapshots, ctx.credentials]) {
			expect(collection.insertOne).not.toHaveBeenCalled();
			expect(collection.updateOne).not.toHaveBeenCalled();
			expect(collection.deleteMany).not.toHaveBeenCalled();
		}
	});

	it("POST /run runs nothing when no store is configured", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/run" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("POST /import/:store/preview refuses a store that isn't configured", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/import/steam/preview" });
		expect(res.statusCode).toBe(500);
		expect(res.json().message).toBe("steam n'est pas configuré");
	});

	it("validates the store and the day", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/import/uplay/preview" })).statusCode).toBe(400);
		expect((await ctx.app.inject({ method: "POST", url: "/replay/steam/yesterday" })).statusCode).toBe(400);
		expect((await ctx.app.inject({ method: "POST", url: "/run", payload: { store: "uplay" } })).statusCode).toBe(
			400,
		);
	});

	it("POST /merge validates the ids and answers 404 for an unknown game", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/merge", payload: { keepId: "x" } })).statusCode).toBe(
			400,
		);

		const res = await ctx.app.inject({
			method: "POST",
			url: "/merge",
			payload: { keepId: KEEP_UUID, removeId: REMOVE_UUID },
		});
		expect(res.statusCode).toBe(404);
	});
});
