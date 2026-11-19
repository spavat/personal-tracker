import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import accountRoutes from "./account.routes";

async function buildApp() {
	const { db, table } = makeFakeDrizzle();
	const app = await buildRouteApp(accountRoutes, { db });
	return { app, db, table };
}

describe("money/accounts routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / lists accounts", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/" });
		expect(res.statusCode).toBe(200);
		expect(ctx.table("moneyAccount").findMany).toHaveBeenCalledTimes(1);
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("GET /:id loads the account by id", async () => {
		await ctx.app.inject({ method: "GET", url: "/5" });
		expect(ctx.table("moneyAccount").findFirst).toHaveBeenCalledWith({ where: { id: 5 } });
	});

	it("POST / rejects an empty create body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/", payload: {} })).statusCode).toBe(400);
	});

	it("DELETE /:id destroys an account with no relations", async () => {
		ctx.table("moneyAccount").findFirst.mockResolvedValue({ id: 9, history: [], paymentTypes: [] });

		const res = await ctx.app.inject({ method: "DELETE", url: "/9" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ deleted: true });
		expect(ctx.db.delete).toHaveBeenCalledTimes(1);
	});

	it("DELETE /:id fails when the account still has history", async () => {
		ctx.table("moneyAccount").findFirst.mockResolvedValue({ id: 9, history: [{}], paymentTypes: [] });
		expect((await ctx.app.inject({ method: "DELETE", url: "/9" })).statusCode).toBe(500);
		expect(ctx.db.delete).not.toHaveBeenCalled();
	});
});
