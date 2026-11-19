import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ShowModule } from "../show.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
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
		expect((await ctx.app.inject({ method: "GET", url: "/show/works" })).statusCode).toBe(200);
		expect(ctx.table("showWork").findMany).toHaveBeenCalled();
	});

	it("GET /grouped returns 200", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/works/grouped" })).statusCode).toBe(200);
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/works/abc" })).statusCode).toBe(400);
	});

	it("POST / rejects an empty body then persists a valid one", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/show/works", payload: {} })).statusCode).toBe(400);

		await ctx.app.close();
		ctx = await buildApp([{ id: 4, name: "Tosca" }]);
		const res = await ctx.app.inject({ method: "POST", url: "/show/works", payload: { name: "Tosca" } });
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ id: 4, name: "Tosca" });
		expect(ctx.db.insert).toHaveBeenCalled();
	});

	it("PUT /:id 404s when updating an unknown work", async () => {
		expect(
			(await ctx.app.inject({ method: "PUT", url: "/show/works/4", payload: { name: "Tosca" } })).statusCode,
		).toBe(404);
	});

	it("DELETE /:id answers 204", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: 4 }]);
		expect((await ctx.app.inject({ method: "DELETE", url: "/show/works/4" })).statusCode).toBe(204);
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});
