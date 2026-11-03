import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import artistRoutes from "./artist.routes";

const callas = { id: 7, name: "Callas", pictureId: null };

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(artistRoutes, { db });
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

	it("GET / runs the sorted list query", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/" });
		expect(res.statusCode).toBe(200);
		expect(ctx.db.select).toHaveBeenCalled();
	});

	it("GET /:id rejects a non-numeric id", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/abc" })).statusCode).toBe(400);
	});

	it("GET /:id 404s for an unknown artist", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/5" });
		expect(res.statusCode).toBe(404);
		expect(res.json().message).toBe("Artiste introuvable");
		expect(ctx.table("showArtist").findFirst).toHaveBeenCalled();
	});

	it("POST /save rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/save", payload: {} })).statusCode).toBe(400);
	});

	it("POST /save creates an artist: 201 with the created artist", async () => {
		await ctx.app.close();
		ctx = await buildApp([callas]);
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: { name: "Callas" } });
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ ...callas, pictureUrl: null });
		expect(ctx.db.insert).toHaveBeenCalled();
	});

	it("POST /save updates an artist: 200 with the updated artist", async () => {
		await ctx.app.close();
		ctx = await buildApp([callas]);
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: callas });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ...callas, pictureUrl: null });
		expect(ctx.db.update).toHaveBeenCalled();
	});

	it("POST /save 404s when updating an unknown artist", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: callas });
		expect(res.statusCode).toBe(404);
	});

	it("DELETE /:id answers 204 without body", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/5" });
		expect(res.statusCode).toBe(204);
		expect(res.body).toBe("");
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});
