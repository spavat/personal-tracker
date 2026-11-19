import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import bankRoutes from "./bank.routes";

async function buildApp() {
	const { db, table } = makeFakeDrizzle();
	const app = await buildRouteApp(bankRoutes, { db });
	return { app, db, table };
}

describe("money/banks routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / lists banks", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/" })).statusCode).toBe(200);
		expect(ctx.table("moneyBank").findMany).toHaveBeenCalledTimes(1);
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/nope" })).statusCode).toBe(400);
	});

	it("GET /:id loads the bank by id", async () => {
		await ctx.app.inject({ method: "GET", url: "/3" });
		expect(ctx.table("moneyBank").findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3 } }));
	});

	it("POST / rejects an empty create body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/", payload: {} })).statusCode).toBe(400);
	});

	it("GET /tree builds the account/payment-type tree", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/tree" })).statusCode).toBe(200);
		expect(ctx.table("moneyBank").findMany).toHaveBeenCalledTimes(1);
	});
});
