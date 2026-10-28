import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import internetRoutes from "./internet.routes";

const PROGRAM_UUID = "11111111-1111-4111-8111-111111111111";
const EPISODE_UUID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_UUID = "33333333-3333-4333-8333-333333333333";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(internetRoutes, { mongo });
	return { app, programs: collection("internet"), sync: collection("internet_sync") };
}

describe("internet routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid program id", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/id/not-a-uuid" })).statusCode).toBe(400);
		});
		it("rejects an empty save body", async () => {
			expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects non-uuid delete ids", async () => {
			expect((await ctx.app.inject({ method: "DELETE", url: "/programs/nope/episodes/nope" })).statusCode).toBe(
				400,
			);
		});
	});

	describe("wiring", () => {
		it("GET /programs runs the overview aggregation", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/programs" })).statusCode).toBe(200);
			expect(ctx.programs.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /episodes runs the range aggregation", async () => {
			expect(
				(await ctx.app.inject({ method: "GET", url: "/episodes?from=2024-01-01&to=2024-12-31" })).statusCode,
			).toBe(200);
			expect(ctx.programs.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /id/:programId loads the program by id", async () => {
			ctx.programs.findOne.mockResolvedValueOnce({ id: PROGRAM_UUID, name: "Prog", episodes: [] });
			const res = await ctx.app.inject({ method: "GET", url: `/id/${PROGRAM_UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.programs.findOne).toHaveBeenCalledWith({ id: PROGRAM_UUID });
		});

		it("DELETE /programs/:programId/episodes/:episodeId pulls the episode", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/programs/${PROGRAM_UUID}/episodes/${EPISODE_UUID}`,
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.programs.updateOne).toHaveBeenCalledWith(
				{ id: PROGRAM_UUID },
				{ $pull: { episodes: { id: EPISODE_UUID } } },
			);
		});

		it("POST /sync/upload accepts a binary body and refuses while a sync is in progress", async () => {
			ctx.sync.countDocuments.mockResolvedValue(3);
			const res = await ctx.app.inject({
				method: "POST",
				url: "/sync/upload",
				headers: { "content-type": "application/octet-stream" },
				payload: Buffer.from("SQLite format 3"),
			});
			expect(res.statusCode).toBe(500);
			expect(res.json().message).toBe("Une synchronisation est déjà en cours");
			expect(ctx.sync.insertMany).not.toHaveBeenCalled();
		});

		it("DELETE /sync/:id removes the proposal", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: `/sync/${PROPOSAL_UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.sync.deleteOne).toHaveBeenCalledWith({ id: PROPOSAL_UUID });
			expect(ctx.programs.updateOne).not.toHaveBeenCalled();
		});

		it("POST /sync/validate/:id saves the episode then removes the proposal", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: `/sync/validate/${PROPOSAL_UUID}`,
				payload: {
					programId: PROGRAM_UUID,
					episode: {
						name: "Ep",
						duration: 30,
						date: "2026-10-01",
						type: "podcast",
						tags: [],
						contextTags: [],
					},
				},
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.programs.updateOne).toHaveBeenCalledWith(
				{ id: PROGRAM_UUID },
				{ $push: { episodes: expect.objectContaining({ name: "Ep" }) } },
			);
			expect(ctx.sync.deleteOne).toHaveBeenCalledWith({ id: PROPOSAL_UUID });
		});
	});
});
