import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { ReadingMangaModule } from "./reading-manga.module.js";

const MANGA_UUID = "11111111-1111-4111-8111-111111111111";
const READING_UUID = "22222222-2222-4222-8222-222222222222";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

async function setup(session: unknown = OWNER) {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildTestApp(ReadingMangaModule, { mongoDb: mongo.db, session });
	return { app, mangas: collection("reading_manga") };
}

describe("ReadingMangaController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	describe("auth", () => {
		it("lets an anonymous visitor read the list and the details", async () => {
			const ctx = await setup(null);
			app = ctx.app;
			ctx.mangas.aggregate
				.mockReturnValueOnce(makeCursor([]))
				.mockReturnValueOnce(makeCursor([{ id: MANGA_UUID }]));

			const list = await app.inject({ method: "GET", url: "/reading-manga/mangas" });
			const details = await app.inject({ method: "GET", url: `/reading-manga/mangas/${MANGA_UUID}` });

			expect(list.statusCode).toBe(200);
			expect(details.statusCode).toBe(200);
		});

		it("rejects an anonymous save with 401", async () => {
			const ctx = await setup(null);
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: "/reading-manga/mangas",
				payload: { manga: { title: "One", status: "in-progress" } },
			});

			expect(res.statusCode).toBe(401);
			expect(ctx.mangas.insertOne).not.toHaveBeenCalled();
		});
	});

	describe("validation", () => {
		it("rejects a non-uuid manga id", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "GET", url: "/reading-manga/mangas/not-a-uuid" });

			expect(res.statusCode).toBe(400);
		});

		it("rejects a manga body without its manga", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "POST", url: "/reading-manga/mangas", payload: {} });

			expect(res.statusCode).toBe(400);
		});

		it("rejects a reading body without its date", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "POST",
				url: `/reading-manga/mangas/${MANGA_UUID}/readings`,
				payload: { name: "Vol. 1", language: "fr", origin: "Livre", type: "volume" },
			});

			expect(res.statusCode).toBe(400);
			expect(ctx.mangas.updateOne).not.toHaveBeenCalled();
		});

		it("rejects deleteReading with a non-uuid readingId", async () => {
			({ app } = await setup());

			const res = await app.inject({
				method: "DELETE",
				url: `/reading-manga/mangas/${MANGA_UUID}/readings/nope`,
			});

			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /mangas parses the query string and runs the list aggregation", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "GET", url: "/reading-manga/mangas?withReadings=false&search=one" });

			expect(res.statusCode).toBe(200);
			const [pipeline] = ctx.mangas.aggregate.mock.calls[0] as unknown as [Record<string, unknown>[]];
			// search adds a $match, withReadings=false hides the readings
			expect(pipeline[0]).toHaveProperty("$match.$or");
			expect(pipeline).toContainEqual({ $project: { _id: 0, readings: 0 } });
		});

		it("GET /mangas/:id 404s for an unknown manga", async () => {
			({ app } = await setup());

			const res = await app.inject({ method: "GET", url: `/reading-manga/mangas/${MANGA_UUID}` });

			expect(res.statusCode).toBe(404);
			expect(res.json()).toMatchObject({ statusCode: 404, code: "not_found", params: { resource: "manga" } });
		});

		it("POST /mangas inserts a new manga and answers 201 with it", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.mangas.aggregate.mockImplementationOnce(() =>
				makeCursor([{ id: MANGA_UUID, title: "One", status: "in-progress", readings: [] }]),
			);

			const res = await app.inject({
				method: "POST",
				url: "/reading-manga/mangas",
				payload: { manga: { title: "One", status: "in-progress" } },
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toMatchObject({ title: "One" });
			expect(ctx.mangas.insertOne).toHaveBeenCalledTimes(1);
			expect(ctx.mangas.insertOne.mock.calls[0][0]).toMatchObject({ title: "One", readings: [] });
		});

		it("DELETE /mangas/:id/readings/:readingId pulls the reading", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({
				method: "DELETE",
				url: `/reading-manga/mangas/${MANGA_UUID}/readings/${READING_UUID}`,
			});

			expect(res.statusCode).toBe(204);
			expect(ctx.mangas.updateOne).toHaveBeenCalledWith(
				{ id: MANGA_UUID, "readings.id": READING_UUID },
				{ $pull: { readings: { id: READING_UUID } } },
			);
		});
	});
});
