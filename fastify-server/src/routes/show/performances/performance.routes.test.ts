import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import performanceRoutes from "./performance.routes";

// no real S3 call when a deleted performance takes role portraits with it
vi.mock("../media/media-storage.repository", () => ({
	MediaStorageRepository: class {
		deleteObject = vi.fn().mockResolvedValue(undefined);
	},
}));

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(performanceRoutes, { db });
	return { app, db, table };
}

describe("show/performances routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / runs the filtered list query", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/" })).statusCode).toBe(200);
		expect(ctx.table("showPerformance").findMany).toHaveBeenCalled();
	});

	it("GET /:performanceId rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
	});

	it("POST /save creates a performance: 201 with the saved row", async () => {
		const saved = {
			id: 11,
			date: "2024-01-01T20:00:00",
			canceled: false,
			seat: "A1",
			placeId: 7,
			spectacleId: 100,
			casting_status: "tbd",
			casting_origin: "na",
			posterId: null,
		};
		await ctx.app.close();
		ctx = await buildApp([saved]);
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: {
				performance: { date: "2024-01-01T20:00", canceled: false, seat: "A1", placeId: 7, spectacleId: 100 },
			},
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual(saved);
	});

	it("POST /save rejects a new spectacle without work", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: {
				spectacle: { name: "Tosca", workId: 0 },
				performance: { date: "2024-01-01T20:00", canceled: false, seat: "", placeId: 7, spectacleId: 0 },
			},
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().message).toContain("A new spectacle needs a work");
	});

	it("POST /saveCasting runs inside a transaction and answers 204", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/saveCasting",
			payload: { performanceId: 10, roles: [] },
		});
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});

	it("DELETE /:id deletes inside a transaction: 204", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: 10 }]);
		const res = await ctx.app.inject({ method: "DELETE", url: "/10" });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});

	it("DELETE /:id 404s when the performance is unknown", async () => {
		await ctx.app.close();
		ctx = await buildApp([]);
		expect((await ctx.app.inject({ method: "DELETE", url: "/10" })).statusCode).toBe(404);
	});

	it("DELETE /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "DELETE", url: "/abc" })).statusCode).toBe(400);
	});
});
