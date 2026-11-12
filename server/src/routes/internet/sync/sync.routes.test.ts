import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../../test-support/fake-mongo";
import { buildRouteApp } from "../../../test-support/route-harness";
import syncRoutes from "./sync.routes";

const PROGRAM_UUID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_UUID = "33333333-3333-4333-8333-333333333333";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(syncRoutes, { mongo });
	return {
		app,
		programs: collection("internet"),
		sync: collection("internet_sync"),
		state: collection("internet_sync_state"),
	};
}

describe("internet sync routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("POST /upload accepts a binary body and refuses while a sync is in progress", async () => {
		ctx.sync.countDocuments.mockResolvedValue(3);
		const res = await ctx.app.inject({
			method: "POST",
			url: "/upload",
			headers: { "content-type": "application/octet-stream" },
			payload: Buffer.from("SQLite format 3"),
		});
		expect(res.statusCode).toBe(500);
		expect(res.json().message).toBe("Une synchronisation est déjà en cours");
		expect(ctx.sync.insertMany).not.toHaveBeenCalled();
	});

	it("DELETE /:id removes the proposal", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: `/${PROPOSAL_UUID}` });
		expect(res.statusCode).toBe(200);
		expect(ctx.sync.deleteOne).toHaveBeenCalledWith({ id: PROPOSAL_UUID });
		expect(ctx.programs.updateOne).not.toHaveBeenCalled();
	});

	it("POST /validate/:id saves the episode then removes the proposal", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: `/validate/${PROPOSAL_UUID}`,
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

	it("GET /gopodder returns the date of the last sync", async () => {
		ctx.state.findOne.mockResolvedValue({ _id: "gopodder", since: 1794500000 });
		const res = await ctx.app.inject({ method: "GET", url: "/gopodder" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ lastSync: "2026-11-12T17:13:20" });
	});

	it("POST /gopodder refuses while a sync is in progress", async () => {
		ctx.sync.countDocuments.mockResolvedValue(1);
		const res = await ctx.app.inject({ method: "POST", url: "/gopodder" });
		expect(res.statusCode).toBe(500);
		expect(res.json().message).toBe("Une synchronisation est déjà en cours");
	});

	it("GET /feeds lists the feeds of the proposals without proposition", async () => {
		ctx.sync.find.mockReturnValue(
			makeCursor([{ id: PROPOSAL_UUID, listened: { podcastUrl: "http://unknown", podcastTitle: "Zeta" } }]),
		);
		const res = await ctx.app.inject({ method: "GET", url: "/feeds" });
		expect(res.statusCode).toBe(200);
		expect(ctx.sync.find).toHaveBeenCalledWith({ proposition: { $exists: false } });
		expect(res.json()).toEqual([{ rssUrl: "http://unknown", title: "Zeta", count: 1 }]);
	});

	it("POST /feeds/link sets the program rss ref", async () => {
		ctx.programs.findOne.mockResolvedValue({ id: PROGRAM_UUID });
		const res = await ctx.app.inject({
			method: "POST",
			url: "/feeds/link",
			payload: { rssUrl: "http://unknown", programId: PROGRAM_UUID },
		});
		expect(res.statusCode).toBe(200);
		expect(ctx.programs.updateOne).toHaveBeenCalledWith(
			{ id: PROGRAM_UUID },
			{ $set: { "refs.rss": "http://unknown" } },
		);
		expect(ctx.sync.find).toHaveBeenCalledWith({ "listened.podcastUrl": "http://unknown" });
	});

	it("POST /feeds/link rejects a non-uuid program id", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/feeds/link",
			payload: { rssUrl: "http://unknown", programId: "nope" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /feeds/ignore deletes the feed's proposals", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/feeds/ignore",
			payload: { rssUrl: "http://unknown" },
		});
		expect(res.statusCode).toBe(200);
		expect(ctx.sync.deleteMany).toHaveBeenCalledWith({ "listened.podcastUrl": "http://unknown" });
	});

	it("POST /reprocess works with and without a feed", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/reprocess" })).statusCode).toBe(200);
		expect(ctx.sync.find).toHaveBeenLastCalledWith({});
		const res = await ctx.app.inject({
			method: "POST",
			url: "/reprocess",
			payload: { rssUrl: "http://unknown" },
		});
		expect(res.statusCode).toBe(200);
		expect(ctx.sync.find).toHaveBeenLastCalledWith({ "listened.podcastUrl": "http://unknown" });
	});
});
