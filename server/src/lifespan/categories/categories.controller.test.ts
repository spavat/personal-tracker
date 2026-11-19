import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../test-support/fake-mongo.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { LifespanModule } from "../lifespan.module.js";

const CATEGORY_UUID = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(LifespanModule, { mongoDb: mongo.db, session });
	return { app, categories: collection("lifespan_category"), objects: collection("lifespan_object") };
}

describe("LifespanCategoriesController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("keeps every route for the owner", async () => {
		({ app } = await setup(null));

		expect((await app.inject({ method: "GET", url: "/lifespan/categories/list" })).statusCode).toBe(401);
	});

	it("GET /list returns the stored categories", async () => {
		const ctx = await setup();
		app = ctx.app;
		ctx.categories.find.mockReturnValueOnce(makeCursor([{ id: CATEGORY_UUID, name: "Clothes", parentId: null }]));

		const res = await app.inject({ method: "GET", url: "/lifespan/categories/list" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([{ id: CATEGORY_UUID, name: "Clothes", parentId: null }]);
	});

	it("POST / rejects a body without a name", async () => {
		({ app } = await setup());

		const res = await app.inject({ method: "POST", url: "/lifespan/categories", payload: { parentId: null } });

		expect(res.statusCode).toBe(400);
	});

	it("POST / inserts a new category and answers 201 with it", async () => {
		const ctx = await setup();
		app = ctx.app;

		const res = await app.inject({
			method: "POST",
			url: "/lifespan/categories",
			payload: { name: "Clothes", parentId: null },
		});

		expect(res.statusCode).toBe(201);
		expect(res.json()).toEqual({ id: expect.any(String), name: "Clothes", parentId: null });
		expect(ctx.categories.insertOne.mock.calls[0][0]).toMatchObject({ name: "Clothes", parentId: null });
	});

	it("PUT /:id answers 409 for a parent among the descendants", async () => {
		const ctx = await setup();
		app = ctx.app;
		const child = "22222222-2222-4222-8222-222222222222";
		ctx.categories.find.mockReturnValueOnce(
			makeCursor([
				{ id: CATEGORY_UUID, name: "Clothes", parentId: null },
				{ id: child, name: "Shoes", parentId: CATEGORY_UUID },
			]),
		);

		const res = await app.inject({
			method: "PUT",
			url: `/lifespan/categories/${CATEGORY_UUID}`,
			payload: { name: "Clothes", parentId: child },
		});

		expect(res.statusCode).toBe(409);
		expect(ctx.categories.findOneAndUpdate).not.toHaveBeenCalled();
	});

	it("DELETE /:id rejects a non-uuid id", async () => {
		({ app } = await setup());

		expect((await app.inject({ method: "DELETE", url: "/lifespan/categories/nope" })).statusCode).toBe(400);
	});

	it("DELETE /:id removes the category by id", async () => {
		const ctx = await setup();
		app = ctx.app;

		const res = await app.inject({ method: "DELETE", url: `/lifespan/categories/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(204);
		expect(ctx.categories.deleteOne).toHaveBeenCalledWith({ id: CATEGORY_UUID });
	});

	it("DELETE /:id answers 409 with a message when sub-categories exist", async () => {
		const ctx = await setup();
		app = ctx.app;
		ctx.categories.find.mockReturnValueOnce(makeCursor([{ id: "child" }]));

		const res = await app.inject({ method: "DELETE", url: `/lifespan/categories/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(409);
		expect(res.json()).toMatchObject({ statusCode: 409, message: expect.stringMatching(/sous-catégories/) });
		expect(ctx.categories.deleteOne).not.toHaveBeenCalled();
	});

	it("DELETE /:id answers 409 when objects still reference the category", async () => {
		const ctx = await setup();
		app = ctx.app;
		ctx.objects.find.mockReturnValueOnce(makeCursor([{ id: "obj-1" }]));

		const res = await app.inject({ method: "DELETE", url: `/lifespan/categories/${CATEGORY_UUID}` });

		expect(res.statusCode).toBe(409);
		expect(res.json()).toMatchObject({ statusCode: 409, message: expect.stringMatching(/objets/) });
	});
});
