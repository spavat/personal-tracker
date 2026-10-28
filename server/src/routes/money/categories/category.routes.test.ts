import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import categoryRoutes from "./category.routes";

async function buildApp() {
	const { db, table } = makeFakeDrizzle({ builderResult: { rowCount: 1 } });
	const app = await buildRouteApp(categoryRoutes, { db });
	return { app, db, table };
}

describe("money/categories routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / lists categories", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/" })).statusCode).toBe(200);
		expect(ctx.table("moneyCategory").findMany).toHaveBeenCalledTimes(1);
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/x" })).statusCode).toBe(400);
	});

	it("POST / rejects an empty create body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/", payload: {} })).statusCode).toBe(400);
	});

	it("DELETE /:id 409s when the category is still referenced", async () => {
		ctx.table("moneyCategory").findMany.mockResolvedValue([{ id: 2 }]); // sub-categories exist
		const res = await ctx.app.inject({ method: "DELETE", url: "/1" });
		expect(res.statusCode).toBe(409);
		expect(res.json()).toHaveProperty("message");
		expect(ctx.db.delete).not.toHaveBeenCalled();
	});

	it("DELETE /:id succeeds for an unused category", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/1" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ deleted: true });
		expect(ctx.db.delete).toHaveBeenCalledTimes(1);
	});
});
