import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import modelRoutes from "./model.routes";

async function buildApp() {
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(modelRoutes, { db });
	return { app, db };
}

describe("show/models routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
	});

	it("DELETE /:id removes the model inside a transaction", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/7" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});
});
