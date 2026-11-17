import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { coreEntity, coreEntityPerson, coreNode } from "../../db/schema";
import { makeFakeDrizzle } from "../../test-support/fake-drizzle";
import { buildRouteApp } from "../../test-support/route-harness";
import entitiesRoutes from "./entity.routes";

const ID = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";
const CARROLL = { id: ID, kind: "person", name: "Lewis Carroll", sortName: "Carroll, Lewis" };
// as stored: the portrait is a key, given as a URL
const CARROLL_ROW = { ...CARROLL, pictureKey: null };
const CARROLL_VIEW = { ...CARROLL, picture: null };

async function buildApp(builderResult?: unknown) {
	const { db } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(entitiesRoutes, { db });
	return { app, db };
}

describe("entities routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / runs the list query", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/?kind=person&search=carroll" });
		expect(res.statusCode).toBe(200);
		expect(ctx.db.select).toHaveBeenCalled();
	});

	it("GET / rejects an unknown kind", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/?kind=robot" })).statusCode).toBe(400);
	});

	it("POST /save rejects an empty name", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: { kind: "person", name: " " } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /save creates the node, the entity and its subtype row", async () => {
		await ctx.app.close();
		ctx = await buildApp([CARROLL_ROW]);
		const { id: _id, ...body } = CARROLL;
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: body });
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual(CARROLL_VIEW);
		expect(ctx.db.insert.mock.calls.map((call: unknown[]) => call[0])).toEqual([
			coreNode,
			coreEntity,
			coreEntityPerson,
		]);
	});

	it("POST /save renames an existing entity and its node", async () => {
		await ctx.app.close();
		ctx = await buildApp([CARROLL_ROW]);
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: CARROLL });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual(CARROLL_VIEW);
		expect(ctx.db.update.mock.calls.map((call: unknown[]) => call[0])).toEqual([coreEntity, coreNode]);
		expect(ctx.db.insert).not.toHaveBeenCalled();
	});

	it("POST /save 404s when no entity has this id and kind", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: CARROLL });
		expect(res.statusCode).toBe(404);
		expect(ctx.db.update).not.toHaveBeenCalled();
	});
});
