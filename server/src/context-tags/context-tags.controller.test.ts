import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { ContextTagsModule } from "./context-tags.module.js";

const UUID = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(ContextTagsModule, { mongoDb: mongo.db, session });
	return { app, tags: collection("context_tags") };
}

describe("ContextTagsController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	describe("auth", () => {
		it("rejects an anonymous visitor with 401", async () => {
			const ctx = await setup(null);
			app = ctx.app;

			const res = await app.inject({ method: "GET", url: "/context-tags" });

			expect(res.statusCode).toBe(401);
			expect(ctx.tags.find).not.toHaveBeenCalled();
		});

		it("checks the session before validating the body (guards run before pipes)", async () => {
			const ctx = await setup(null);
			app = ctx.app;

			const res = await app.inject({ method: "POST", url: "/context-tags", payload: { name: 42 } });

			expect(res.statusCode).toBe(401);
		});
	});

	describe("GET /context-tags", () => {
		it("returns the stored tags", async () => {
			const ctx = await setup();
			app = ctx.app;
			const stored = [{ id: UUID, name: "Genre", tags: ["scifi"] }];
			ctx.tags.find.mockReturnValueOnce(makeCursor(stored));

			const res = await app.inject({ method: "GET", url: "/context-tags" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual(stored);
		});

		it("strips the fields the response schema does not declare", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.tags.find.mockReturnValueOnce(makeCursor([{ id: UUID, name: "Genre", tags: ["scifi"], secret: "x" }]));

			const res = await app.inject({ method: "GET", url: "/context-tags" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([{ id: UUID, name: "Genre", tags: ["scifi"] }]);
		});

		it("answers 500 when a stored document breaks the response schema", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.tags.find.mockReturnValueOnce(makeCursor([{ id: UUID, name: 42, tags: ["scifi"] }]));

			const res = await app.inject({ method: "GET", url: "/context-tags" });

			expect(res.statusCode).toBe(500);
		});
	});

	describe("POST /context-tags", () => {
		it("rejects an invalid body with 400 and writes nothing", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: "/context-tags",
				payload: { name: 42, tags: [] },
			});

			expect(res.statusCode).toBe(400);
			expect(ctx.tags.insertOne).not.toHaveBeenCalled();
		});

		it("inserts a new tag with a generated id, without the unknown keys, and answers 201 with it", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: "/context-tags",
				payload: { name: "Genre", tags: ["scifi"], admin: true },
			});

			expect(res.statusCode).toBe(201);
			const tag = { id: expect.any(String), name: "Genre", tags: ["scifi"] };
			expect(ctx.tags.insertOne).toHaveBeenCalledWith(tag);
			expect(res.json()).toEqual(tag);
		});
	});

	describe("PUT /context-tags/:id", () => {
		it("answers 200 with the updated tag", async () => {
			const ctx = await setup();
			app = ctx.app;
			const updated = { id: UUID, name: "Genre", tags: ["polar"] };
			ctx.tags.findOneAndUpdate.mockResolvedValueOnce(updated);

			const res = await app.inject({
				method: "PUT",
				url: `/context-tags/${UUID}`,
				payload: { name: "Genre", tags: ["polar"] },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual(updated);
			expect(ctx.tags.findOneAndUpdate).toHaveBeenCalledWith(
				{ id: UUID },
				{ $set: { name: "Genre", tags: ["polar"] } },
				expect.anything(),
			);
		});

		it("answers 404 when updating an id that matches nothing", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "PUT",
				url: `/context-tags/${UUID}`,
				payload: { name: "Genre", tags: [] },
			});

			expect(res.statusCode).toBe(404);
			expect(res.json()).toMatchObject({ statusCode: 404, error: "Not Found" });
		});
	});

	describe("DELETE /context-tags/:id", () => {
		it("rejects an id that is not a UUID with 400", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "DELETE", url: "/context-tags/abc" });

			expect(res.statusCode).toBe(400);
			expect(ctx.tags.deleteOne).not.toHaveBeenCalled();
		});

		it("answers 404 when nothing was deleted", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.tags.deleteOne.mockResolvedValueOnce({ acknowledged: true, deletedCount: 0 });

			const res = await app.inject({ method: "DELETE", url: `/context-tags/${UUID}` });

			expect(res.statusCode).toBe(404);
		});

		it("deletes an existing tag", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "DELETE", url: `/context-tags/${UUID}` });

			expect(res.statusCode).toBe(204);
			expect(ctx.tags.deleteOne).toHaveBeenCalledWith({ id: UUID });
		});
	});
});
