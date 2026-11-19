import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import contextTagRoutes from "./context-tag.routes";

const UUID = "11111111-1111-4111-8111-111111111111";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(contextTagRoutes, { mongo });
	return { app, tags: collection("context_tags") };
}

describe("context-tags routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /list returns the stored tags", async () => {
		ctx.tags.find.mockReturnValueOnce({
			toArray: () => Promise.resolve([{ id: UUID, name: "Genre", tags: ["scifi"] }]),
		} as never);

		const res = await ctx.app.inject({ method: "GET", url: "/list" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([{ id: UUID, name: "Genre", tags: ["scifi"] }]);
	});

	it("POST /save rejects a body without a name", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: { tags: [] } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /save inserts a new tag", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: { name: "Genre", tags: ["scifi"] },
		});

		expect(res.statusCode).toBe(200);
		expect(ctx.tags.insertOne).toHaveBeenCalledTimes(1);
		expect(ctx.tags.insertOne.mock.calls[0][0]).toMatchObject({ name: "Genre", tags: ["scifi"] });
	});

	it("DELETE /:id rejects a non-uuid id", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/nope" });
		expect(res.statusCode).toBe(400);
	});

	it("DELETE /:id removes the tag by id", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: `/${UUID}` });

		expect(res.statusCode).toBe(200);
		expect(ctx.tags.deleteOne).toHaveBeenCalledWith({ id: UUID });
	});
});
