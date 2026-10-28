import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import performanceRoutes from "./performance.routes";

async function buildApp() {
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(performanceRoutes, { db });
	return { app, db };
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
		expect(ctx.db.select).toHaveBeenCalled();
	});

	it("GET /:performanceId rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
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

	it("POST /saveCasting runs inside a transaction and reports ok", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/saveCasting",
			payload: { performanceId: 10, roles: [] },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});
});
