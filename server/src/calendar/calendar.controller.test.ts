import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { CalendarModule } from "./calendar.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function buildApp() {
	const { mongo } = makeFakeMongo();
	const { db } = makeFakeDrizzle();
	const app = await buildTestApp(CalendarModule, { mongoDb: mongo.db, drizzle: db, session: OWNER });
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
		expect((await ctx.app.inject({ method: "GET", url: "/calendar/monthly" })).statusCode).toBe(400);
	});

	it("GET /monthly returns an empty calendar for a quiet month", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/calendar/monthly?period=2024-05" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /period returns an empty calendar for a quiet range", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/calendar/period?from=2024-05-01&to=2024-05-31" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /daily returns an empty object for a quiet day", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/calendar/daily?date=2024-05-01" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({});
	});
});
