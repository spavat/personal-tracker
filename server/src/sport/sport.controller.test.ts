import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp, makeFakeStorage } from "../test-support/test-app.js";
import { SportModule } from "./sport.module.js";

const UUID = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const ACTIVITY = {
	id: UUID,
	name: "Morning run",
	type: "running",
	date: "2024-06-01T10:00:00",
	created: "2024-06-01T11:00:00",
	details: { movingDuration: 30, totalDuration: 30, distance: 5, pace: 6 },
};

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const storage = makeFakeStorage();
	const app = await buildTestApp(SportModule, { mongoDb: mongo.db, session, storage });
	return { app, activities: collection("sport"), storage };
}

describe("SportController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("keeps every route for the owner", async () => {
		({ app } = await setup(null));
		expect((await app.inject({ method: "GET", url: "/sport/list" })).statusCode).toBe(401);
	});

	describe("validation", () => {
		it("rejects a non-uuid activity id", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/sport/id?id=nope" })).statusCode).toBe(400);
		});

		it("rejects segments with duplicate times", async () => {
			({ app } = await setup());
			const res = await app.inject({
				method: "POST",
				url: "/sport/segments",
				payload: {
					id: UUID,
					segments: [
						{ time: 0, type: "running" },
						{ time: 0, type: "pause" },
					],
				},
			});
			expect(res.statusCode).toBe(400);
		});

		it("rejects a crop where startIndex isn't before endIndex", async () => {
			({ app } = await setup());
			const res = await app.inject({
				method: "POST",
				url: "/sport/crop",
				payload: { id: UUID, startIndex: 2, endIndex: 2 },
			});
			expect(res.statusCode).toBe(400);
		});

		it("answers 400 to a new activity without date nor GPX file", async () => {
			const ctx = await setup();
			app = ctx.app;
			const { id, date, created, ...body } = ACTIVITY;

			const res = await app.inject({ method: "POST", url: "/sport/save", payload: body });

			expect(res.statusCode).toBe(400);
			expect(res.json()).toMatchObject({ error: "Bad Request" });
			expect(ctx.activities.insertOne).not.toHaveBeenCalled();
		});
	});

	describe("reads", () => {
		it("GET /list strips the fields outside the response schema", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.activities.find.mockReturnValueOnce({
				toArray: async () => [{ ...ACTIVITY, internal: true }],
			} as never);

			const res = await app.inject({ method: "GET", url: "/sport/list?from=2024-06-01&to=2024-06-30" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([ACTIVITY]);
		});

		it("GET /id 404s for an unknown activity", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: `/sport/id?id=${UUID}` })).statusCode).toBe(404);
		});
	});

	describe("download", () => {
		it("redirects to a signed url of the GPX file", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.activities.findOne.mockResolvedValueOnce({ name: "Morning run", gpxKey: "key/a1.gpx" });

			const res = await app.inject({ method: "GET", url: `/sport/download?id=${UUID}` });

			expect(res.statusCode).toBe(302);
			expect(res.headers.location).toBe("https://signed.example/file");
			expect(ctx.storage.signedDownloadUrl).toHaveBeenCalledWith("key/a1.gpx", "Morning run.gpx");
		});

		it("404s when the activity has no GPX file", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: `/sport/download?id=${UUID}` })).statusCode).toBe(404);
		});
	});

	it("DELETE /:id removes the activity and its files", async () => {
		const ctx = await setup();
		app = ctx.app;
		ctx.activities.findOneAndDelete.mockResolvedValueOnce({ ...ACTIVITY, gpxKey: "g.gpx", thumbnailKey: "t.avif" });

		const res = await app.inject({ method: "DELETE", url: `/sport/${UUID}` });

		expect(res.statusCode).toBe(200);
		expect(ctx.activities.findOneAndDelete).toHaveBeenCalledWith({ id: UUID });
		expect(ctx.storage.delete.mock.calls).toEqual([["g.gpx"], ["t.avif"]]);
	});
});
