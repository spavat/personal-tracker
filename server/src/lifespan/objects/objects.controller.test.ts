import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../test-support/fake-mongo.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { LifespanModule } from "../lifespan.module.js";

const OBJECT_UUID = "11111111-1111-4111-8111-111111111111";
const EVENT_UUID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_UUID = "33333333-3333-4333-8333-333333333333";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(LifespanModule, { mongoDb: mongo.db, session });
	return { app, objects: collection("lifespan_object") };
}

describe("LifespanObjectsController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("keeps every route for the owner", async () => {
		({ app } = await setup(null));

		expect((await app.inject({ method: "GET", url: "/lifespan/objects" })).statusCode).toBe(401);
	});

	describe("validation", () => {
		it("rejects a non-uuid object id", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/lifespan/objects/not-a-uuid" })).statusCode).toBe(400);
		});

		it("rejects an object body without its object", async () => {
			({ app } = await setup());
			const res = await app.inject({ method: "POST", url: "/lifespan/objects", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a dispose event without its cause", async () => {
			({ app } = await setup());
			const res = await app.inject({
				method: "POST",
				url: `/lifespan/objects/${OBJECT_UUID}/events`,
				payload: { type: "dispose", date: "2024-06-01" },
			});
			expect(res.statusCode).toBe(400);
		});

		it("rejects non-uuid delete-event ids", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "DELETE", url: "/lifespan/objects/nope/events/nope" })).statusCode).toBe(
				400,
			);
		});
	});

	describe("wiring", () => {
		it("GET / runs the overview aggregation with the query filters", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "GET", url: `/lifespan/objects?categoryId=${CATEGORY_UUID}` });

			expect(res.statusCode).toBe(200);
			const [pipeline] = ctx.objects.aggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
			expect(pipeline[0]).toEqual({ $match: { categoryId: CATEGORY_UUID } });
		});

		it("GET /:id returns the object with its derived statuses", async () => {
			const ctx = await setup();
			app = ctx.app;
			const object = {
				id: OBJECT_UUID,
				name: "Phone",
				categoryId: CATEGORY_UUID,
				events: [],
				usageStatus: "not_started",
				possessionStatus: "owned",
			};
			ctx.objects.aggregate.mockReturnValueOnce(makeCursor([object]));

			const res = await app.inject({ method: "GET", url: `/lifespan/objects/${OBJECT_UUID}` });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual(object);
		});

		it("GET /:id 404s for an unknown object", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "GET", url: `/lifespan/objects/${OBJECT_UUID}` });

			expect(res.statusCode).toBe(404);
			expect(res.json()).toMatchObject({ message: "Objet introuvable" });
		});

		it("PUT /:id keeps the free text type on update and answers the updated object", async () => {
			const ctx = await setup();
			app = ctx.app;
			const object = {
				id: OBJECT_UUID,
				name: "MX Master",
				type: "souris",
				categoryId: CATEGORY_UUID,
				events: [],
			};
			ctx.objects.findOneAndUpdate.mockResolvedValueOnce(object);

			const res = await app.inject({
				method: "PUT",
				url: `/lifespan/objects/${OBJECT_UUID}`,
				payload: { object: { name: "MX Master", type: "souris", categoryId: CATEGORY_UUID } },
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual(object);
			expect(ctx.objects.findOneAndUpdate.mock.calls[0][1]).toMatchObject({
				$set: expect.objectContaining({ type: "souris" }),
			});
		});

		it("DELETE /:objectId/events/:eventId pulls the event, not the object", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "DELETE",
				url: `/lifespan/objects/${OBJECT_UUID}/events/${EVENT_UUID}`,
			});

			expect(res.statusCode).toBe(204);
			expect(ctx.objects.updateOne).toHaveBeenCalledWith(
				{ id: OBJECT_UUID, "events.id": EVENT_UUID },
				{ $pull: { events: { id: EVENT_UUID } } },
			);
			expect(ctx.objects.deleteOne).not.toHaveBeenCalled();
		});

		it("DELETE /:id removes the object", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "DELETE", url: `/lifespan/objects/${OBJECT_UUID}` });

			expect(res.statusCode).toBe(204);
			expect(ctx.objects.deleteOne).toHaveBeenCalledWith({ id: OBJECT_UUID });
		});
	});
});
