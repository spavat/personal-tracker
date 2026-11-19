import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import mangaRoutes from "./manga.routes";

const MANGA_UUID = "11111111-1111-4111-8111-111111111111";
const READING_UUID = "22222222-2222-4222-8222-222222222222";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(mangaRoutes, { mongo });
	return { app, mangas: collection("reading_manga") };
}

describe("reading-manga routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid manga id", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/mangas/not-a-uuid" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a save body that is neither a manga nor a reading+mangaId", async () => {
			const res = await ctx.app.inject({ method: "POST", url: "/save", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects deleteReading with a non-uuid readingId", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/mangas/${MANGA_UUID}/readings/nope`,
			});
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /mangas runs the list aggregation", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/mangas" });
			expect(res.statusCode).toBe(200);
			expect(ctx.mangas.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /mangas/:id runs the details aggregation", async () => {
			ctx.mangas.aggregate.mockReturnValueOnce(makeCursor([{ id: MANGA_UUID, title: "One" }]));
			const res = await ctx.app.inject({ method: "GET", url: `/mangas/${MANGA_UUID}` });
			expect(res.statusCode).toBe(200);
			expect(ctx.mangas.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /mangas/:id 404s for an unknown manga", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/mangas/${MANGA_UUID}` });
			expect(res.statusCode).toBe(404);
			expect(res.json().message).toBe("Manga introuvable");
		});

		it("POST /save inserts a new manga", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { manga: { title: "One", status: "in-progress" } },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.mangas.insertOne).toHaveBeenCalledTimes(1);
			expect(ctx.mangas.insertOne.mock.calls[0][0]).toMatchObject({ title: "One", readings: [] });
		});

		it("DELETE /mangas/:id/readings/:readingId pulls the reading", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/mangas/${MANGA_UUID}/readings/${READING_UUID}`,
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.mangas.updateOne).toHaveBeenCalledWith(
				{ id: MANGA_UUID },
				{ $pull: { readings: { id: READING_UUID } } },
			);
		});
	});
});
