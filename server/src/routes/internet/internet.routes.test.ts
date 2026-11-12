import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../test-support/fake-mongo";
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
			// anonymous viewer (no auth plugin here): private programs are filtered out
			expect(ctx.programs.findOne).toHaveBeenCalledWith({ private: { $ne: true }, id: PROGRAM_UUID });
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

		it("POST /sync/gopodder refuses while a sync is in progress", async () => {
			ctx.sync.countDocuments.mockResolvedValue(1);
			const res = await ctx.app.inject({ method: "POST", url: "/sync/gopodder" });
			expect(res.statusCode).toBe(500);
			expect(res.json().message).toBe("Une synchronisation est déjà en cours");
		});

		it("GET /sync/feeds lists the feeds of the proposals without proposition", async () => {
			ctx.sync.find.mockReturnValue(
				makeCursor([{ id: PROPOSAL_UUID, listened: { podcastUrl: "http://unknown", podcastTitle: "Zeta" } }]),
			);
			const res = await ctx.app.inject({ method: "GET", url: "/sync/feeds" });
			expect(res.statusCode).toBe(200);
			expect(ctx.sync.find).toHaveBeenCalledWith({ proposition: { $exists: false } });
			expect(res.json()).toEqual([{ rssUrl: "http://unknown", title: "Zeta", count: 1 }]);
		});

		it("POST /sync/feeds/link sets the program rss ref", async () => {
			ctx.programs.findOne.mockResolvedValue({ id: PROGRAM_UUID });
			const res = await ctx.app.inject({
				method: "POST",
				url: "/sync/feeds/link",
				payload: { rssUrl: "http://unknown", programId: PROGRAM_UUID },
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.programs.updateOne).toHaveBeenCalledWith(
				{ id: PROGRAM_UUID },
				{ $set: { "refs.rss": "http://unknown" } },
			);
			expect(ctx.sync.find).toHaveBeenCalledWith({ "listened.podcastUrl": "http://unknown" });
		});

		it("POST /sync/feeds/link rejects a non-uuid program id", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/sync/feeds/link",
				payload: { rssUrl: "http://unknown", programId: "nope" },
			});
			expect(res.statusCode).toBe(400);
		});

		it("POST /sync/feeds/ignore deletes the feed's proposals", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/sync/feeds/ignore",
				payload: { rssUrl: "http://unknown" },
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.sync.deleteMany).toHaveBeenCalledWith({ "listened.podcastUrl": "http://unknown" });
		});

		it("POST /sync/reprocess works with and without a feed", async () => {
			expect((await ctx.app.inject({ method: "POST", url: "/sync/reprocess" })).statusCode).toBe(200);
			expect(ctx.sync.find).toHaveBeenLastCalledWith({});
			const res = await ctx.app.inject({
				method: "POST",
				url: "/sync/reprocess",
				payload: { rssUrl: "http://unknown" },
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.sync.find).toHaveBeenLastCalledWith({ "listened.podcastUrl": "http://unknown" });
		});
	});
});
