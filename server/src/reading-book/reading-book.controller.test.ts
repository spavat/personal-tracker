import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	coreNode,
	readingBook,
	readingBookContributor,
	readingEdition,
	readingEditionContributor,
	readingEntry,
	readingModel,
	readingReading,
	readingSeries,
	readingSeriesItem,
} from "../database/schema.js";
import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp } from "../test-support/test-app.js";
import { ReadingBookModule } from "./reading-book.module.js";

const UUID = "11111111-1111-4111-8111-111111111111";
const READING_UUID = "22222222-2222-4222-8222-222222222222";
const CHAPTER_UUID = "33333333-3333-4333-8333-333333333333";
const EDITION_UUID = "44444444-4444-4444-8444-444444444444";
const MODEL_UUID = "55555555-5555-4555-8555-555555555555";
const ENTITY_UUID = "66666666-6666-4666-8666-666666666666";
const SERIES_UUID = "77777777-7777-4777-8777-777777777777";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
// the id a new edition or model gets: the writes answer it read back from the book
const NEW_UUID = "88888888-8888-4888-8888-888888888888";
vi.mock("node:crypto", async (original) => ({
	...(await original<typeof import("node:crypto")>()),
	randomUUID: () => NEW_UUID,
}));

// The book row the writes read back, holding a model, an edition and a reading of these ids
function bookRow({ modelId = MODEL_UUID, editionId = EDITION_UUID, readingId = READING_UUID } = {}) {
	return {
		id: UUID,
		title: "Dune",
		originalLanguage: "en",
		originalYear: 1965,
		country: "us",
		contributors: [{ role: "author", creditedAs: null, entity: { id: ENTITY_UUID, name: "Frank Herbert" } }],
		series: [],
		models: [{ id: modelId, name: "VO", tree: [] }],
		editions: [
			{
				id: editionId,
				title: null,
				publisher: null,
				collection: null,
				contributors: [],
				language: "fr",
				pages: null,
				type: "print",
				isbn: null,
				year: null,
				coverKey: null,
				modelId,
				readings: [{ id: readingId, status: "complete", entries: [] }],
			},
		],
	};
}

const tablesOf = (fn: { mock: { calls: unknown[][] } }) => fn.mock.calls.map((call) => call[0]);

async function buildApp(builderResult?: unknown) {
	const { mongo } = makeFakeMongo();
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ReadingBookModule, { mongoDb: mongo.db, drizzle: db, session: OWNER });
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
			const res = await ctx.app.inject({ method: "GET", url: "/reading-book/books/not-a-uuid" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a report request without a period", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/reading-book/reports" });
			expect(res.statusCode).toBe(400);
		});

		it("rejects a save with a missing body", async () => {
			const res = await ctx.app.inject({ method: "POST", url: "/reading-book/books", payload: {} });
			expect(res.statusCode).toBe(400);
		});

		it("rejects deleteReading when readingId is not a uuid", async () => {
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/reading-book/books/${UUID}/readings/nope`,
			});
			expect(res.statusCode).toBe(400);
		});
	});

	describe("wiring", () => {
		it("GET /books runs the list query", async () => {
			const res = await ctx.app.inject({ method: "GET", url: "/reading-book/books?withReadingsDetails=true" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([]);
			expect(ctx.db.select).toHaveBeenCalled();
		});

		it("GET /books/:id 404s on an unknown book", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/reading-book/books/${UUID}` });
			expect(res.statusCode).toBe(404);
			expect(ctx.books.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UUID } }));
		});

		it("POST /books creates the node, the book, its authors, a model and an edition", async () => {
			await ctx.app.close();
			// every select answers this row: the book's id, and 1 entity found for the author check
			ctx = await buildApp([{ id: UUID, count: 1 }]);
			ctx.books.findFirst.mockResolvedValue(bookRow());

			const res = await ctx.app.inject({
				method: "POST",
				url: "/reading-book/books",
				payload: {
					book: "Dune",
					authors: [{ entityId: ENTITY_UUID, creditedAs: null }],
					originalLanguage: "en",
					originalYear: 1965,
					country: "us",
				},
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toMatchObject({ id: UUID, book: "Dune" });
			expect(tablesOf(ctx.db.insert)).toEqual([
				coreNode,
				readingBook,
				readingBookContributor,
				readingModel,
				readingEdition,
			]);
		});

		it("POST /books/:id/editions/:editionId/readings starts a reading on the edition", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: EDITION_UUID, coverKey: null, nbReadings: 0, nbBookEditions: 1 }]);

			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/editions/${EDITION_UUID}/readings`,
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toEqual({ id: NEW_UUID, status: "in-progress", details: [] });
			expect(tablesOf(ctx.db.insert)).toEqual([readingReading]);
		});

		it("POST /books/:id/editions/:editionId/readings 404s on an edition of another book", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/editions/${EDITION_UUID}/readings`,
			});

			expect(res.statusCode).toBe(404);
			expect(ctx.db.insert).not.toHaveBeenCalled();
		});

		it("POST /books/:id/editions creates an edition with its publisher and translators", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: EDITION_UUID, count: 1 }]);
			ctx.books.findFirst.mockResolvedValue(bookRow({ editionId: NEW_UUID }));

			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/editions`,
				payload: {
					title: null,
					publisherId: ENTITY_UUID,
					collection: "Folio SF",
					translators: [{ entityId: ENTITY_UUID, creditedAs: "M. Demuth" }],
					language: "fr",
					pages: 830,
					type: "print",
					isbn: null,
					year: 2021,
					cover: null,
					modelId: null,
				},
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toMatchObject({ id: NEW_UUID });
			expect(tablesOf(ctx.db.insert)).toEqual([readingEdition, readingEditionContributor]);
		});

		it("POST /books/:id/editions accepts a cover of several MB sent as a data URI", async () => {
			const cover = `data:image/png;base64,${"A".repeat(6 * 1024 * 1024)}`;
			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/editions`,
				payload: { type: "audio", cover },
			});
			// past the body limit: refused by the validation, not as too large (413)
			expect(res.statusCode).toBe(400);
		});

		it("POST /books/:id/models creates a model", async () => {
			await ctx.app.close();
			// the select finds the book, the insert returns the new model's id
			ctx = await buildApp([{ id: MODEL_UUID }]);
			ctx.books.findFirst.mockResolvedValue(bookRow());

			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/models`,
				payload: { name: "VO", tree: [{ id: CHAPTER_UUID, title: "I" }] },
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toEqual({ id: MODEL_UUID, name: "VO", tree: [] });
			expect(tablesOf(ctx.db.insert)).toEqual([readingModel]);
		});

		it("POST /books/:id/models rejects a model without name", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/models`,
				payload: { name: " ", tree: [] },
			});
			expect(res.statusCode).toBe(400);
		});

		it("DELETE /books/:id/models/:modelId refuses a model used by a read edition", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: MODEL_UUID, nbReadEditions: 1 }]);

			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/reading-book/books/${UUID}/models/${MODEL_UUID}`,
			});

			expect(res.statusCode).toBe(409);
			expect(ctx.db.delete).not.toHaveBeenCalled();
		});

		it("POST /books/:id/editions rejects an unknown edition type", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: `/reading-book/books/${UUID}/editions`,
				payload: { type: "audio" },
			});
			expect(res.statusCode).toBe(400);
		});

		it("DELETE /books/:id/editions/:editionId refuses the book's last edition", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: EDITION_UUID, coverKey: null, nbReadings: 0, nbBookEditions: 1 }]);

			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/reading-book/books/${UUID}/editions/${EDITION_UUID}`,
			});

			expect(res.statusCode).toBe(409);
			expect(ctx.db.delete).not.toHaveBeenCalled();
		});

		it("PUT /books/:id/readings/:readingId replaces the reading's entries", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: READING_UUID }]);
			ctx.books.findFirst.mockResolvedValue(bookRow());

			const res = await ctx.app.inject({
				method: "PUT",
				url: `/reading-book/books/${UUID}/readings/${READING_UUID}`,
				payload: {
					id: READING_UUID,
					status: "complete",
					details: [{ id: CHAPTER_UUID, context: [{ date: "2024-06-01", tags: ["metro"] }] }],
				},
			});

			expect(res.statusCode).toBe(200);
			expect(res.json()).toMatchObject({ id: READING_UUID });
			expect(tablesOf(ctx.db.update)).toEqual([readingReading]);
			expect(tablesOf(ctx.db.delete)).toEqual([readingEntry]);
			expect(tablesOf(ctx.db.insert)).toEqual([readingEntry]);
		});

		it("DELETE /books/:id/readings/:readingId deletes the reading", async () => {
			await ctx.app.close();
			ctx = await buildApp([{ id: READING_UUID }]);
			const res = await ctx.app.inject({
				method: "DELETE",
				url: `/reading-book/books/${UUID}/readings/${READING_UUID}`,
			});

			expect(res.statusCode).toBe(204);
			expect(tablesOf(ctx.db.delete)).toEqual([readingReading]);
		});

		it("POST /books rejects a book without author", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/reading-book/books",
				payload: { book: "Dune", authors: [], originalLanguage: "", originalYear: null, country: "" },
			});
			expect(res.statusCode).toBe(400);
		});

		it("GET /authors lists the authors, publicly", async () => {
			await ctx.app.close();
			ctx = await buildApp([
				{ id: ENTITY_UUID, name: "Lewis Carroll", sortName: null, nbBooks: 1, nbReadings: 2 },
			]);

			const res = await ctx.app.inject({ method: "GET", url: "/reading-book/authors" });

			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual([
				{ id: ENTITY_UUID, name: "Lewis Carroll", sortName: null, picture: null, nbBooks: 1, nbReadings: 2 },
			]);
		});

		it("GET /authors/:id 404s on an unknown author", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/reading-book/authors/${ENTITY_UUID}` });
			expect(res.statusCode).toBe(404);
		});

		it("POST /series creates the node, the series and its items in order", async () => {
			await ctx.app.close();
			// every select answers this row: 1 book and 1 sub-series found, and no item (no cycle); the series read back
			ctx = await buildApp([{ id: SERIES_UUID, title: "Terre du Milieu", count: 1 }]);

			const res = await ctx.app.inject({
				method: "POST",
				url: "/reading-book/series",
				payload: {
					title: "Terre du Milieu",
					items: [
						{ kind: "book", bookId: UUID, positionLabel: "1" },
						{ kind: "series", seriesId: EDITION_UUID, positionLabel: null },
					],
				},
			});

			expect(res.statusCode).toBe(201);
			expect(res.json()).toMatchObject({ id: SERIES_UUID });
			expect(tablesOf(ctx.db.insert)).toEqual([coreNode, readingSeries, readingSeriesItem]);
		});

		it("POST /series rejects a series without title", async () => {
			const res = await ctx.app.inject({
				method: "POST",
				url: "/reading-book/series",
				payload: { title: " ", items: [] },
			});
			expect(res.statusCode).toBe(400);
		});

		it("GET /series/:id 404s on an unknown series, publicly", async () => {
			const res = await ctx.app.inject({ method: "GET", url: `/reading-book/series/${SERIES_UUID}` });
			expect(res.statusCode).toBe(404);
		});

		it("GET /reports returns a schema-valid empty report", async () => {
			const res = await ctx.app.inject({
				method: "GET",
				url: "/reading-book/reports?from=2024-01-01&to=2024-12-31",
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

describe("reading-book access", () => {
	it("opens the books, series and authors to visitors, not the report nor the writes", async () => {
		const { mongo } = makeFakeMongo();
		const { db } = makeFakeDrizzle();
		const app = await buildTestApp(ReadingBookModule, { mongoDb: mongo.db, drizzle: db, session: null });
		try {
			for (const url of ["/reading-book/books", "/reading-book/series", "/reading-book/authors"]) {
				expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(200);
			}
			const report = await app.inject({
				method: "GET",
				url: "/reading-book/reports?from=2024-01-01&to=2024-12-31",
			});
			const save = await app.inject({ method: "POST", url: "/reading-book/books", payload: {} });
			expect(report.statusCode).toBe(401);
			expect(save.statusCode).toBe(401);
		} finally {
			await app.close();
		}
	});
});
