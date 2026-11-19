import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import modelRoutes from "./model.routes";

async function buildApp(builderResult?: unknown) {
	const { db } = makeFakeDrizzle({ builderResult });
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

	it("POST /save creates a model: 201 with the model, without its roles", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: 7, name: "Cast A", spectacleId: 3 }]);
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: { name: "Cast A", spectacleId: 3, roles: [{ name: "Lead", main: true, order: 0, artistId: 5 }] },
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ id: 7, name: "Cast A", spectacleId: 3 });
	});

	it("DELETE /:id removes the model inside a transaction", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/7" });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});
});
