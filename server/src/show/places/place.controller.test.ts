import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ShowModule } from "../../show/show.module.js";
import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function buildApp(builderResult?: unknown) {
	const { db } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
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
		expect((await ctx.app.inject({ method: "GET", url: "/show/places" })).statusCode).toBe(200);
		expect(ctx.db.select).toHaveBeenCalled();
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/places/abc" })).statusCode).toBe(400);
	});

	it("POST /save rejects a body missing address/country", async () => {
		expect(
			(await ctx.app.inject({ method: "POST", url: "/show/places/save", payload: { name: "Bastille" } }))
				.statusCode,
		).toBe(400);
	});

	it("POST /save persists a valid place and replaces its former names", async () => {
		const place = { id: 3, name: "Bastille", address: "Paris", country: "fr", link: null };
		await ctx.app.close();
		ctx = await buildApp([place]);
		const formerNames = [{ name: "Old Bastille", untilDate: "2027-01-01" }];
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/places/save",
			payload: { ...place, formerNames },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ...place, formerNames });
		expect(ctx.db.update).toHaveBeenCalled();
		expect(ctx.db.delete).toHaveBeenCalled();
		expect(ctx.db.insert).toHaveBeenCalled();
	});

	it("POST /save 404s when updating an unknown place", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/places/save",
			payload: { id: 3, name: "Bastille", address: "Paris", country: "fr", formerNames: [] },
		});
		expect(res.statusCode).toBe(404);
		expect(ctx.db.delete).not.toHaveBeenCalled();
	});

	it("POST /save rejects two former names ending on the same date", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/places/save",
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

	it("DELETE /:id answers 204", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/show/places/3" });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});
