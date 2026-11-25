import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ShowModule } from "../show.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const MODEL_ID = "00000000-0000-4000-8000-000000000007";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000003";

async function buildApp(builderResult?: unknown) {
	const { db } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
	return { app, db };
}

describe("show/models routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /:id rejects an id that is not a uuid", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/models/abc" })).statusCode).toBe(400);
	});

	it("POST / rejects an empty body", async () => {
		expect((await ctx.app.inject({ method: "POST", url: "/show/models", payload: {} })).statusCode).toBe(400);
	});

	it("POST / creates a model: 201 with the model, without its roles", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID }]);
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/models",
			payload: {
				name: "Cast A",
				spectacleId: SPECTACLE_ID,
				roles: [{ name: "Lead", main: true, order: 0, entityId: "00000000-0000-4000-8000-000000000005" }],
			},
		});
		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID });
	});

	it("DELETE /:id removes the model inside a transaction", async () => {
		await ctx.app.close();
		ctx = await buildApp([{ id: MODEL_ID }]);
		const res = await ctx.app.inject({ method: "DELETE", url: `/show/models/${MODEL_ID}` });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.transaction).toHaveBeenCalledTimes(1);
	});
});
