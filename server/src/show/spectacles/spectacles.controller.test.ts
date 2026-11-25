import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ShowModule } from "../show.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000001";
const WORK_ID = "00000000-0000-4000-8000-000000000002";

async function buildApp(builderResult?: unknown) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
	return { app, db, table };
}

describe("show/spectacles routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / lists spectacles", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/spectacles" })).statusCode).toBe(200);
		expect(ctx.table("showSpectacle").findMany).toHaveBeenCalled();
	});

	it("GET /grouped returns 200", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/spectacles/grouped" })).statusCode).toBe(200);
	});

	it("GET /:id rejects an id that is not a uuid", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/show/spectacles/abc" })).statusCode).toBe(400);
	});

	it("GET /:id 404s for an unknown spectacle", async () => {
		const res = await ctx.app.inject({
			method: "GET",
			url: "/show/spectacles/00000000-0000-4000-8000-000000000005",
		});
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ statusCode: 404, code: "not_found", params: { resource: "spectacle" } });
	});

	it("PUT /:id rejects an invalid link then updates a valid spectacle", async () => {
		const payload = {
			id: SPECTACLE_ID,
			name: "Tosca",
			workId: WORK_ID,
			links: [{ label: "Wikipédia", url: "pas une url" }],
		};
		expect(
			(await ctx.app.inject({ method: "PUT", url: `/show/spectacles/${SPECTACLE_ID}`, payload })).statusCode,
		).toBe(400);

		payload.links[0].url = "https://fr.wikipedia.org/wiki/Tosca";
		await ctx.app.close();
		ctx = await buildApp([payload]);
		const res = await ctx.app.inject({ method: "PUT", url: `/show/spectacles/${SPECTACLE_ID}`, payload });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual(payload);
		expect(ctx.db.update).toHaveBeenCalled();
	});

	it("PUT /:id 404s when updating an unknown spectacle", async () => {
		const payload = { id: SPECTACLE_ID, name: "Tosca", workId: WORK_ID };
		expect(
			(await ctx.app.inject({ method: "PUT", url: `/show/spectacles/${SPECTACLE_ID}`, payload })).statusCode,
		).toBe(404);
	});
});
