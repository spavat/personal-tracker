import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import workRoutes from "./work.routes";

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(workRoutes, { db });
	return { app, db, table };
}

describe("show/works routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / lists works", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/" })).statusCode).toBe(200);
		expect(ctx.table("showWork").findMany).toHaveBeenCalled();
	});

	it("GET /grouped returns 200", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/grouped" })).statusCode).toBe(200);
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects an empty body then persists a valid one", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);

		await ctx.app.close();
		ctx = await buildApp([{ id: 4, name: "Tosca" }]);
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: { name: "Tosca" } });
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ id: 4, name: "Tosca" });
		expect(ctx.db.insert).toHaveBeenCalled();
	});

	it("POST /save 404s when updating an unknown work", async () => {
		expect(
			(await ctx.app.inject({ method: "POST", url: "/save", payload: { id: 4, name: "Tosca" } })).statusCode,
		).toBe(404);
	});

	it("DELETE /:id answers 204", async () => {
		expect((await ctx.app.inject({ method: "DELETE", url: "/4" })).statusCode).toBe(204);
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});
