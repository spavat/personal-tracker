import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import bookRoutes from "./book.routes";

const UUID = "11111111-1111-4111-8111-111111111111";
const READING_UUID = "22222222-2222-4222-8222-222222222222";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(bookRoutes, { mongo });
	return { app, books: collection("reading_book"), contextTags: collection("context_tags") };
}

describe("reading-book routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});

	afterEach(async () => {
		await ctx.app.close();
	});

	describe("validation", () => {
		it("rejects a non-uuid book id", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/books/not-a-uuid" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a report request without a period", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/reports" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a save with a missing body", async () => {
			const res = await ctx.app.inject({ method: "POST", url: "/save", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects deleteReading when readingId is not a uuid", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/books/${UUID}/readings/nope`,
			});
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /books runs the list aggregation", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/books" });
			expect(res.statusCode).toBe(200);
			expect(ctx.books.aggregate).toHaveBeenCalledTimes(1);
		});

		it("GET /books/:id loads the book by id", async () => {
			ctx.books.findOne.mockResolvedValueOnce({ id: UUID, book: "Dune" });

			const res = await ctx.app.inject({ method: "GET", url: `/books/${UUID}` });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ id: UUID, book: "Dune" });
			expect(ctx.books.findOne).toHaveBeenCalledWith({ id: UUID }, { projection: { _id: 0 } });
		});

		it("POST /save inserts a new book", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { book: "Dune", author: ["Herbert"], language: "en", country: "us", pages: 412 },
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.books.insertOne).toHaveBeenCalledTimes(1);
			expect(ctx.books.insertOne.mock.calls[0][0]).toMatchObject({
				book: "Dune",
				author: ["Herbert"],
				readings: [],
				model: [],
			});
		});

		it("POST /books/:id/readings pushes a new reading", async () => {
			const res = await ctx.app.inject({ method: "POST", url: `/books/${UUID}/readings` });

			expect(res.statusCode).toBe(200);
			expect(ctx.books.updateOne).toHaveBeenCalledTimes(1);
			const [filter, update] = ctx.books.updateOne.mock.calls[0];
			expect(filter).toEqual({ id: UUID });
			expect(update.$push.readings).toMatchObject({ status: "in-progress", details: [] });
		});

		it("DELETE /books/:id/readings/:readingId pulls the reading", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/books/${UUID}/readings/${READING_UUID}`,
			});

			expect(res.statusCode).toBe(200);
			expect(ctx.books.updateOne).toHaveBeenCalledWith(
				{ id: UUID },
				{ $pull: { readings: { id: READING_UUID } } },
			);
		});

		it("GET /reports returns a schema-valid empty report", async () => {
			const res = await ctx.app.inject({
				method: "GET",
				url: "/reports?from=2024-01-01&to=2024-12-31",
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({
				hasData: false,
				streakInfo: { days: 0, start: null, end: null },
				statusDistribution: [],
				tagDistribution: [],
				langDistribution: [],
				authorDistribution: [],
			});
		});
	});
});
