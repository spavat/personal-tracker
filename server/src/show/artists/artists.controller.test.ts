import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ShowModule } from "../show.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const ARTIST_ID = "00000000-0000-4000-8000-000000000005";

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
	return { app, db, table };
}

describe("show/artists routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /:id rejects an id that is not a uuid", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/artists/abc" })).statusCode).toBe(400);
	});

	it("GET /:id 404s for an unknown artist", async () => {
		const res = await ctx.app.inject({ method: "GET", url: `/show/artists/${ARTIST_ID}` });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ statusCode: 404, code: "not_found", params: { resource: "artist" } });
		expect(ctx.table("coreEntity").findFirst).toHaveBeenCalled();
	});

	// an artist is an entity: written through /entities
	it.each([
		["POST", "/show/artists"],
		["PUT", `/show/artists/${ARTIST_ID}`],
		["DELETE", `/show/artists/${ARTIST_ID}`],
	] as const)("%s %s is not a route", async (method, url) => {
		expect((await ctx.app.inject({ method, url, payload: { name: "Callas" } })).statusCode).toBe(404);
	});
});
