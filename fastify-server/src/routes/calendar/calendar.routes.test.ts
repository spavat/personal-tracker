import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle";
import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import calendarRoutes from "./calendar.routes";

async function buildApp() {
	const { mongo } = makeFakeMongo();
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(calendarRoutes, { mongo, db });
	return { app };
}

describe("calendar routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /monthly requires a period", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/monthly" })).statusCode).toBe(400);
	});

	it("GET /monthly returns an empty calendar for a quiet month", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/monthly?period=2024-05" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /period returns an empty calendar for a quiet range", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/period?from=2024-05-01&to=2024-05-31" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /daily returns an empty object for a quiet day", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/daily?date=2024-05-01" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({});
	});
});
