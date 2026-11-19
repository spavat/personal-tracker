import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../../test-support/fake-mongo";
import { buildRouteApp } from "../../../test-support/route-harness";
import categoryRoutes from "./category.routes";

const CATEGORY_UUID = "11111111-1111-4111-8111-111111111111";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(categoryRoutes, { mongo });
	return { app, categories: collection("lifespan_category"), objects: collection("lifespan_object") };
}

describe("lifespan/categories routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /list returns the stored categories", async () => {
		ctx.categories.find.mockReturnValueOnce({
			toArray: () => Promise.resolve([{ id: CATEGORY_UUID, name: "Clothes", parentId: null }]),
		} as never);

		const res = await ctx.app.inject({ method: "GET", url: "/list" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([{ id: CATEGORY_UUID, name: "Clothes", parentId: null }]);
	});

	it("POST /save rejects a body without a name", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/save", payload: { parentId: null } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /save inserts a new category", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/save",
			payload: { name: "Clothes", parentId: null },
		});

		expect(res.statusCode).toBe(200);
		expect(ctx.categories.insertOne).toHaveBeenCalledTimes(1);
		expect(ctx.categories.insertOne.mock.calls[0][0]).toMatchObject({ name: "Clothes", parentId: null });
	});

	it("DELETE /:id rejects a non-uuid id", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/nope" });
		expect(res.statusCode).toBe(400);
	});

	it("DELETE /:id removes the category by id", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: `/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ deleted: true });
		expect(ctx.categories.deleteOne).toHaveBeenCalledWith({ id: CATEGORY_UUID });
	});

	it("DELETE /:id returns 409 when sub-categories still exist", async () => {
		ctx.categories.find.mockReturnValueOnce({
			toArray: () => Promise.resolve([{ id: "child" }]),
		} as never);

		const res = await ctx.app.inject({ method: "DELETE", url: `/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(409);
		expect(res.json()).toEqual({ deleted: false, reason: "has_children" });
		expect(ctx.categories.deleteOne).not.toHaveBeenCalled();
	});

	it("DELETE /:id returns 409 when objects still reference the category", async () => {
		ctx.categories.find.mockReturnValueOnce({ toArray: () => Promise.resolve([]) } as never); // no sub-categories
		ctx.objects.find.mockReturnValueOnce({
			toArray: () => Promise.resolve([{ id: "obj-1" }]),
		} as never);

		const res = await ctx.app.inject({ method: "DELETE", url: `/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(409);
		expect(res.json()).toEqual({ deleted: false, reason: "in_use" });
	});
});
