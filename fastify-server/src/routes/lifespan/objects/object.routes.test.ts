import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../../test-support/fake-mongo";
import { buildRouteApp } from "../../../test-support/route-harness";
import objectRoutes from "./object.routes";

const OBJECT_UUID = "11111111-1111-4111-8111-111111111111";
const EVENT_UUID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_UUID = "33333333-3333-4333-8333-333333333333";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(objectRoutes, { mongo });
	return { app, objects: collection("lifespan_object") };
}

describe("lifespan/objects routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid object id", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/not-a-uuid" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a save body that is neither an object nor an event+objectId", async () => {
			const res = await ctx.app.inject({ method: "POST", url: "/save", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects non-uuid delete-event ids", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: "/nope/events/nope" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a non-uuid delete id", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: "/nope" });
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET / runs the overview aggregation", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/" });
			expect(res.statusCode).toBe(200);
			expect(ctx.objects.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /:id loads the object by id via the status aggregation", async () => {
			ctx.objects.aggregate.mockReturnValueOnce(
				makeCursor([
					{
						id: OBJECT_UUID,
						name: "Phone",
						categoryId: CATEGORY_UUID,
						events: [],
						usageStatus: "not_started",
						possessionStatus: "owned",
					},
				]),
			);

			const res = await ctx.app.inject({ method: "GET", url: `/${OBJECT_UUID}` });

			expect(res.statusCode).toBe(200);
			expect(ctx.objects.aggregate).toHaveBeenCalledTimes(1);
			expect(res.json()).toEqual({
				id: OBJECT_UUID,
				name: "Phone",
				categoryId: CATEGORY_UUID,
				events: [],
				usageStatus: "not_started",
				possessionStatus: "owned",
			});
		});

		it("POST /save inserts a new object", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { object: { name: "Phone", categoryId: CATEGORY_UUID } },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.objects.insertOne).toHaveBeenCalledTimes(1);
			expect(ctx.objects.insertOne.mock.calls[0][0]).toMatchObject({ name: "Phone", events: [] });
		});

		it("POST /save keeps the free text type on update", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { object: { id: OBJECT_UUID, name: "MX Master", type: "souris", categoryId: CATEGORY_UUID } },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.objects.updateOne).toHaveBeenCalledTimes(1);
			expect(ctx.objects.updateOne.mock.calls[0][1]).toMatchObject({
				$set: expect.objectContaining({ type: "souris" }),
			});
		});

		it("DELETE /:objectId/events/:eventId pulls the event from the object", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/${OBJECT_UUID}/events/${EVENT_UUID}`,
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.objects.updateOne).toHaveBeenCalledWith(
				{ id: OBJECT_UUID },
				{ $pull: { events: { id: EVENT_UUID } } },
			);
		});

		it("DELETE /:id removes the object", async () => {
			const res = await ctx.app.inject({ method: "DELETE", url: `/${OBJECT_UUID}` });

			expect(res.statusCode).toBe(200);
			expect(ctx.objects.deleteOne).toHaveBeenCalledWith({ id: OBJECT_UUID });
		});
	});
});
