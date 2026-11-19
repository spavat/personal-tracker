import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import sportRoutes from "./sport.routes";

const UUID = "11111111-1111-4111-8111-111111111111";

const ACTIVITY = {
	id: UUID,
	name: "Morning run",
	type: "run",
	date: "2024-06-01T10:00:00",
	created: "2024-06-01T11:00:00",
	details: { movingDuration: 30, totalDuration: 30, distance: 5, pace: 6 },
};

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(sportRoutes, { mongo });
	return { app, activities: collection("sport") };
}

describe("sport routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid activity id", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/id?id=nope" })).statusCode).toBe(400);
		});
		it("rejects a non-uuid delete id", async () => {
			expect((await ctx.app.inject({ method: "DELETE", url: "/nope" })).statusCode).toBe(400);
		});
		it("rejects an incomplete save body", async () => {
			expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
		});
		it("rejects segments with duplicate times", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/segments",
				payload: {
					id: UUID,
					segments: [
						{ time: 0, type: "running" },
						{ time: 0, type: "pause" },
					],
				},
			});
			expect(res.statusCode).toBe(400);
		});
		it("rejects a crop where startIndex isn't before endIndex", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/crop",
				payload: { id: UUID, startIndex: 2, endIndex: 2 },
			});
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /list queries activities", async () => {
			expect((await ctx.app.inject({ method: "GET", url: "/list" })).statusCode).toBe(200);
			expect(ctx.activities.find).toHaveBeenCalledTimes(1);
		});

		it("GET /id loads one activity by id", async () => {
			ctx.activities.findOne.mockResolvedValueOnce(ACTIVITY);
			const res = await ctx.app.inject({ method: "GET", url: `/id?id=${UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.activities.findOne).toHaveBeenCalledWith({ id: UUID }, { projection: { _id: 0, rawData: 0 } });
		});

		it("GET /download 404s when the activity has no gpx key", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/download?id=${UUID}` });
			expect(res.statusCode).toBe(404);
		});

		it("DELETE /:id removes the activity by id", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: `/${UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.activities.findOneAndDelete).toHaveBeenCalledWith({ id: UUID });
		});

		it("POST /crop replaces the activity's points/details/segments with the cropped range", async () => {
			ctx.activities.findOne.mockResolvedValueOnce({
				points: [
					{ id: "pt-0", lat: 48.85, lon: 2.35, time: "2024-06-01T10:00:00.000Z", distanceFromStart: 0 },
					{ id: "pt-1", lat: 48.86, lon: 2.36, time: "2024-06-01T10:01:00.000Z", distanceFromStart: 1000 },
					{ id: "pt-2", lat: 48.87, lon: 2.37, time: "2024-06-01T10:02:00.000Z", distanceFromStart: 2000 },
				],
			});

			const res = await ctx.app.inject({
				method: "POST",
				url: "/crop",
				payload: { id: UUID, startIndex: 0, endIndex: 1 },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.activities.updateOne).toHaveBeenCalledWith(
				{ id: UUID },
				{
					$set: expect.objectContaining({
						points: expect.any(Array),
						details: expect.any(Object),
						segments: [],
					}),
				},
				{ upsert: false },
			);
		});

		it("POST /segments replaces the activity's segments, sorted by time", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/segments",
				payload: {
					id: UUID,
					segments: [
						{ time: 60, type: "pause" },
						{ time: 0, type: "running" },
					],
				},
			});
			expect(res.statusCode).toBe(200);
			expect(ctx.activities.updateOne).toHaveBeenCalledWith(
				{ id: UUID },
				{
					$set: {
						segments: [
							{ time: 0, type: "running" },
							{ time: 60, type: "pause" },
						],
					},
				},
				{ upsert: false },
			);
		});
	});
});
