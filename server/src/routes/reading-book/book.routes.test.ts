import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	coreNode,
	readingBook,
	readingBookContributor,
	readingEdition,
	readingEntry,
	readingModel,
	readingReading,
} from "../../db/schema";
import { makeFakeDrizzle } from "../../test-support/fake-drizzle";
import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import bookRoutes from "./book.routes";

const UUID = "11111111-1111-4111-8111-111111111111";
const READING_UUID = "22222222-2222-4222-8222-222222222222";
const CHAPTER_UUID = "33333333-3333-4333-8333-333333333333";

const tablesOf = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls.map((call) => call[0]);

async function buildApp(builderResult?: unknown) {
	const { mongo } = makeFakeMongo();
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(bookRoutes, { mongo, db });
	return { app, db, books: table("readingBook") };
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
		it("GET /books runs the list query", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/books?withReadingsDetails=true" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([]);
			expect(ctx.db.select).toHaveBeenCalled();
		});

		it("GET /books/:id 404s on an unknown book", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/books/${UUID}` });
			expect(res.statusCode).toBe(404);
			expect(ctx.books.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UUID } }));
		});

		it("POST /save creates the node, the book, its authors, a model and an edition", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: UUID }]);

			const res = await ctx.app.inject({
				method: "POST",
				url: "/save",
				payload: { book: "Dune", author: ["Herbert"], language: "en", country: "us", pages: 412 },
			});

			expect(res.statusCode).toBe(200);
			expect(tablesOf(ctx.db.insert)).toEqual([
				coreNode,
				readingBook,
				readingBookContributor,
				readingModel,
				readingEdition,
			]);
		});

		it("POST /books/:id/readings starts a reading on the book's edition", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: "edition-1" }]);

			const res = await ctx.app.inject({ method: "POST", url: `/books/${UUID}/readings` });

			expect(res.statusCode).toBe(204);
			expect(tablesOf(ctx.db.insert)).toEqual([readingReading]);
		});

		it("POST /books/:id/saveReading replaces the reading's entries", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: READING_UUID }]);

			const res = await ctx.app.inject({
				method: "POST",
				url: `/books/${UUID}/saveReading`,
				payload: {
					id: READING_UUID,
					status: "complete",
					details: [{ id: CHAPTER_UUID, context: [{ date: "2024-06-01", tags: ["metro"] }] }],
				},
			});

			expect(res.statusCode).toBe(204);
			expect(tablesOf(ctx.db.update)).toEqual([readingReading]);
			expect(tablesOf(ctx.db.delete)).toEqual([readingEntry]);
			expect(tablesOf(ctx.db.insert)).toEqual([readingEntry]);
		});

		it("DELETE /books/:id/readings/:readingId deletes the reading", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/books/${UUID}/readings/${READING_UUID}`,
			});

			expect(res.statusCode).toBe(204);
			expect(tablesOf(ctx.db.delete)).toEqual([readingReading]);
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
