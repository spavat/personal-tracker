import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import placeRoutes from "./place.routes";

async function buildApp() {
	const { db } = makeFakeDrizzle();
	const app = await buildRouteApp(placeRoutes, { db });
	return { app, db };
}

describe("show/places routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / runs the sorted list query", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/" })).statusCode).toBe(200);
		expect(ctx.db.select).toHaveBeenCalled();
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects a body missing address/country", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: { name: "Bastille" } })).statusCode).toBe(
			400,
		);
	});

	it("POST /save persists a valid place and replaces its former names", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: {
				id: 3,
				name: "Bastille",
				address: "Paris",
				country: "fr",
				formerNames: [{ name: "Old Bastille", untilDate: "2027-01-01" }],
			},
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
		expect(ctx.db.update).toHaveBeenCalled();
		expect(ctx.db.delete).toHaveBeenCalled();
		expect(ctx.db.insert).toHaveBeenCalled();
	});

	it("POST /save rejects two former names ending on the same date", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: {
				name: "Bastille",
				address: "Paris",
				country: "fr",
				formerNames: [
					{ name: "A", untilDate: "2015-01-01" },
					{ name: "B", untilDate: "2015-01-01" },
				],
			},
		});
		expect(res.statusCode).toBe(400);
	});

	it("DELETE /:id reports ok", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/3" });
		expect(res.statusCode).toBe(200);
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});
