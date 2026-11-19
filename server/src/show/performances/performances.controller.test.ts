import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ShowModule } from "../show.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

// no real S3 call when a deleted performance takes role portraits with it
vi.mock("../media/media-storage.repository", () => ({
	MediaStorageRepository: class {
		deleteObject = vi.fn().mockResolvedValue(undefined);
	},
}));

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
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
		expect((await ctx.app.inject({ method: "GET", url: "/show/performances" })).statusCode).toBe(200);
		expect(ctx.table("showPerformance").findMany).toHaveBeenCalled();
	});

	it("GET /:performanceId rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/performances/abc" })).statusCode).toBe(400);
	});

	it("POST / rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/show/performances", payload: {} })).statusCode).toBe(400);
	});

	it("POST / creates a performance: 201 with the saved row", async () => {
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
			url: "/show/performances",
			payload: {
				performance: { date: "2024-01-01T20:00", canceled: false, seat: "A1", placeId: 7, spectacleId: 100 },
			},
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual(saved);
	});

	it("POST / rejects a new spectacle without work", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/performances",
			payload: {
				spectacle: { name: "Tosca", workId: 0 },
				performance: { date: "2024-01-01T20:00", canceled: false, seat: "", placeId: 7, spectacleId: 0 },
			},
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().message).toContain("A new spectacle needs a work");
	});

	it("PUT /:id/casting runs inside a transaction and answers 204", async () => {
		const res = await ctx.app.inject({
			method: "PUT",
			url: "/show/performances/10/casting",
			payload: { performanceId: 10, roles: [] },
		});
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});

	it("DELETE /:id deletes inside a transaction: 204", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: 10 }]);
		const res = await ctx.app.inject({ method: "DELETE", url: "/show/performances/10" });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});

	it("DELETE /:id 404s when the performance is unknown", async () => {
		await ctx.app.close();
		ctx = await buildApp([]);
		expect((await ctx.app.inject({ method: "DELETE", url: "/show/performances/10" })).statusCode).toBe(404);
	});

	it("DELETE /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "DELETE", url: "/show/performances/abc" })).statusCode).toBe(400);
	});
});
