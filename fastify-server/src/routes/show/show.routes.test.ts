import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle";
import { buildRouteApp } from "../../test-support/route-harness";
import showRoutes from "./show.routes";

async function buildApp() {
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(showRoutes, { db });
	return { app, db };
}

describe("show root routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /search returns an empty list when nothing matches", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/search?search=tosca" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /reports requires a period", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/reports" })).statusCode).toBe(400);
	});

	it("GET /reports returns a schema-valid empty report", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/reports?from=2024-01-01&to=2024-12-31" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({
			hasData: false,
			stats: { spectacles: 0, performances: 0, newSpectacles: 0, countryDistribution: [] },
			periodList: [],
			totalList: [],
		});
	});
});
