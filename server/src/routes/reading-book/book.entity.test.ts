import type { Book, BookOverview } from "@personal-tracker/shared/reading-book";

import { describe, expect, it } from "vitest";

import {
	type BookRow,
	buildInitialReading,
	buildTitleMap,
	getLongestConsecutiveStreak,
	median,
	sortBookOverviews,
	toBook,
	toBookOverviews,
	toEntries,
} from "./book.entity";

describe("buildTitleMap", () => {
	it("maps id -> title for flat items", () => {
		const map = buildTitleMap([
			{ id: "a", title: "Chapter A" },
			{ id: "b", title: "Chapter B" },
		]);
		expect(map).toEqual({ a: "Chapter A", b: "Chapter B" });
	});

	it("skips items without a title", () => {
		const map = buildTitleMap([{ id: "a", title: "Chapter A" }, { id: "b" }]);
		expect(map).toEqual({ a: "Chapter A" });
	});

	it("recurses into nested content", () => {
		const map = buildTitleMap([
			{
				id: "part1",
				title: "Part 1",
				content: [
					{ id: "c1", title: "Chapter 1" },
					{ id: "c2", title: "Chapter 2", content: [{ id: "s1", title: "Section 1" }] },
				],
			},
		]);
		expect(map).toEqual({ part1: "Part 1", c1: "Chapter 1", c2: "Chapter 2", s1: "Section 1" });
	});
});

describe("getLongestConsecutiveStreak", () => {
	it("returns zeros for an empty list", () => {
		expect(getLongestConsecutiveStreak([])).toEqual({ days: 0, start: null, end: null });
	});

	it("returns a single-day streak for one date", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01"])).toEqual({
			days: 1,
			start: "2024-06-01",
			end: "2024-06-01",
		});
	});

	it("finds a fully consecutive run", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01", "2024-06-02", "2024-06-03"])).toEqual({
			days: 3,
			start: "2024-06-01",
			end: "2024-06-03",
		});
	});

	it("picks the longest run when there are gaps, regardless of input order", () => {
		expect(
			getLongestConsecutiveStreak([
				"2024-06-10",
				"2024-06-01",
				"2024-06-11",
				"2024-06-02",
				"2024-06-12",
				"2024-06-13",
			]),
		).toEqual({ days: 4, start: "2024-06-10", end: "2024-06-13" });
	});

	it("keeps the first run on a tie", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01", "2024-06-02", "2024-06-05", "2024-06-06"])).toEqual({
			days: 2,
			start: "2024-06-01",
			end: "2024-06-02",
		});
	});

	it("handles a month boundary as consecutive", () => {
		expect(getLongestConsecutiveStreak(["2024-01-31", "2024-02-01"])).toEqual({
			days: 2,
			start: "2024-01-31",
			end: "2024-02-01",
		});
	});
});

describe("median", () => {
	it("returns the middle value for an odd-length list", () => {
		expect(median([3, 1, 2])).toBe(2);
	});

	it("averages the two middle values for an even-length list", () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
	});

	it("does not mutate the input", () => {
		const input = [5, 1, 3];
		median(input);
		expect(input).toEqual([5, 1, 3]);
	});

	it("throws on an empty list", () => {
		expect(() => median([])).toThrow("Cannot calculate median of an empty array");
	});
});

describe("buildInitialReading", () => {
	it("returns an in-progress reading with no details and a fresh id", () => {
		const a = buildInitialReading();
		const b = buildInitialReading();

		expect(a).toMatchObject({ status: "in-progress", details: [] });
		expect(a.id).toEqual(expect.any(String));
		expect(a.id).not.toBe(b.id);
	});
});

const ctx = (date: string, tags: string[] = []) => ({ date, tags });

function book(id: string, readings: Book["readings"], fields: Partial<Book> = {}): Book {
	return { id, book: id, author: ["A"], language: "fr", country: "fr", pages: null, model: [], readings, ...fields };
}

describe("toBook", () => {
	const row: BookRow = {
		id: "b1",
		title: "Dune",
		country: "us",
		contributors: [
			{ role: "author", entity: { name: "Frank Herbert" } },
			{ role: "illustrator", entity: { name: "Someone" } },
		],
		editions: [
			{
				language: "en",
				pages: 412,
				model: { tree: [{ id: "c1", title: "I" }] },
				readings: [
					{
						id: "r1",
						status: "complete",
						entries: [
							{ chapterId: "c2", date: "2024-06-01", tags: ["metro"] },
							{ chapterId: "c1", date: "2024-06-01", tags: [] },
							{ chapterId: "c2", date: "2024-06-03", tags: [] },
						],
					},
				],
			},
		],
	};

	it("gives the former Mongo shape: authors only, edition fields, details grouped by chapter", () => {
		expect(toBook(row)).toEqual({
			id: "b1",
			book: "Dune",
			author: ["Frank Herbert"],
			language: "en",
			country: "us",
			pages: 412,
			model: [{ id: "c1", title: "I" }],
			readings: [
				{
					id: "r1",
					status: "complete",
					details: [
						{ id: "c2", context: [ctx("2024-06-01", ["metro"]), ctx("2024-06-03")] },
						{ id: "c1", context: [ctx("2024-06-01")] },
					],
				},
			],
		});
	});

	it("defaults the edition fields of a book without edition", () => {
		expect(toBook({ ...row, country: null, editions: [] })).toMatchObject({
			language: "",
			country: "",
			pages: null,
			model: [],
			readings: [],
		});
	});
});

describe("toEntries", () => {
	it("writes one entry per chapter and day, merging the tags of the same day", () => {
		expect(
			toEntries("r1", [
				{ id: "c1", context: [ctx("2024-06-01", ["metro"]), ctx("2024-06-01", ["metro", "bus"])] },
				{ id: "c2", context: [ctx("2024-06-01")] },
			]),
		).toEqual({
			entries: [
				{ readingId: "r1", chapterId: "c1", date: "2024-06-01", tags: ["metro", "bus"] },
				{ readingId: "r1", chapterId: "c2", date: "2024-06-01", tags: [] },
			],
			merged: 1,
		});
	});
});

describe("toBookOverviews", () => {
	const reading = (id: string, details: Book["readings"][number]["details"]) => ({
		id,
		status: "complete" as const,
		details,
	});

	it("adds the reading and book dates, and the number of readings", () => {
		const [overview] = toBookOverviews(
			[book("b1", [reading("r1", [{ id: "c1", context: [ctx("2024-06-03"), ctx("2024-06-01")] }])])],
			{ withReadingsDetails: true },
		);
		expect(overview).toMatchObject({
			readingDates: ["2024-06-01", "2024-06-03"],
			firstReadDate: "2024-06-01",
			lastReadDate: "2024-06-03",
			nbReadings: 1,
			readings: [{ readingDates: ["2024-06-01", "2024-06-03"], firstReadDate: "2024-06-01" }],
		});
	});

	it("keeps a never read book with null dates when there is no period", () => {
		expect(toBookOverviews([book("b1", [])], { withReadingsDetails: false })).toEqual([
			expect.objectContaining({ readingDates: [], firstReadDate: null, lastReadDate: null, nbReadings: 0 }),
		]);
	});

	it("drops the details unless asked for", () => {
		const [overview] = toBookOverviews(
			[book("b1", [reading("r1", [{ id: "c1", context: [ctx("2024-06-01")] }])])],
			{
				withReadingsDetails: false,
			},
		);
		expect(overview.readings[0]).not.toHaveProperty("details");
	});

	it("with a period, keeps only the readings and details with a date in it", () => {
		const books = [
			book("b1", [
				reading("before", [{ id: "c1", context: [ctx("2023-12-01")] }]),
				reading("across", [
					{ id: "c1", context: [ctx("2023-12-30")] },
					// a kept detail keeps all its dates, even outside the period
					{ id: "c2", context: [ctx("2023-12-31"), ctx("2024-01-02")] },
				]),
			]),
			book("b2", [reading("outside", [{ id: "c1", context: [ctx("2025-01-01")] }])]),
		];

		const overviews = toBookOverviews(books, { from: "2024-01-01", to: "2024-12-31", withReadingsDetails: true });

		expect(overviews.map(({ id }) => id)).toEqual(["b1"]);
		const [b1] = overviews as Array<BookOverview & { readings: Book["readings"] }>;
		expect(b1.readings.map(({ id }) => id)).toEqual(["across"]);
		// the reading's own dates come from all its details, before the details are filtered
		expect(b1.readings[0]).toMatchObject({
			readingDates: ["2023-12-30", "2023-12-31", "2024-01-02"],
			details: [{ id: "c2" }],
		});
		expect(b1).toMatchObject({
			readingDates: ["2023-12-31", "2024-01-02"],
			firstReadDate: "2023-12-31",
			nbReadings: 1,
		});
	});
});

describe("sortBookOverviews", () => {
	const overview = (id: string, fields: Partial<BookOverview>) => ({ id, ...fields }) as BookOverview;

	it("puts the books never read first when ascending, last when descending", () => {
		const books = [
			overview("b1", { lastReadDate: "2024-06-01" }),
			overview("never", { lastReadDate: null as unknown as string }),
			overview("b2", { lastReadDate: "2024-07-01" }),
		];
		expect(sortBookOverviews(books, "lastReadDate", "asc").map(({ id }) => id)).toEqual(["never", "b1", "b2"]);
		expect(sortBookOverviews(books, "lastReadDate", "desc").map(({ id }) => id)).toEqual(["b2", "b1", "never"]);
	});

	it("sorts authors by their first name ascending, by their last name descending", () => {
		const books = [overview("b1", { author: ["Bob", "Zoé"] }), overview("b2", { author: ["Carl"] })];
		expect(sortBookOverviews(books, "author", "asc").map(({ id }) => id)).toEqual(["b1", "b2"]);
		expect(sortBookOverviews(books, "author", "desc").map(({ id }) => id)).toEqual(["b1", "b2"]);
	});

	it("compares strings by code point, as Mongo does (accents after z)", () => {
		const books = [overview("e", { book: "Émile" }), overview("z", { book: "Zola" })];
		expect(sortBookOverviews(books, "book", "asc").map(({ id }) => id)).toEqual(["z", "e"]);
	});

	it("keeps the order for an unknown field", () => {
		const books = [overview("b2", {}), overview("b1", {})];
		expect(sortBookOverviews(books, "name", "asc").map(({ id }) => id)).toEqual(["b2", "b1"]);
	});
});
