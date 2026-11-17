import { describe, expect, it } from "vitest";

import {
	type BookRow,
	buildInitialReading,
	buildTitleMap,
	getLongestConsecutiveStreak,
	median,
	toBook,
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

describe("toBook", () => {
	const edition: BookRow["editions"][number] = {
		id: "e1",
		title: "Dune (fr)",
		publisher: { id: "pub", name: "Pocket" },
		contributors: [
			{ role: "translator", creditedAs: null, entity: { id: "t1", name: "Michel Demuth" } },
			{ role: "translator", creditedAs: "M. D.", entity: { id: "t2", name: "Someone" } },
		],
		language: "fr",
		pages: 830,
		type: "print",
		isbn: "978-2266320481",
		year: 2021,
		coverKey: "personal-tracker/reading-book/edition/e1.0a1b2c3d.avif",
		modelId: "m1",
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
	};
	const row: BookRow = {
		id: "b1",
		title: "Dune",
		originalLanguage: "en",
		originalYear: 1965,
		country: "us",
		contributors: [
			{ role: "author", creditedAs: null, entity: { id: "a1", name: "Frank Herbert" } },
			{ role: "illustrator", creditedAs: null, entity: { id: "i1", name: "Someone" } },
		],
		models: [{ id: "m1", name: "VO", tree: [{ id: "c1", title: "I" }] }],
		editions: [edition],
	};

	it("gives the book, its model and its editions, with the readings grouped by chapter", () => {
		expect(toBook(row)).toEqual({
			id: "b1",
			book: "Dune",
			authors: [{ entityId: "a1", name: "Frank Herbert", creditedAs: null }],
			originalLanguage: "en",
			originalYear: 1965,
			country: "us",
			models: [{ id: "m1", name: "VO", tree: [{ id: "c1", title: "I" }] }],
			editions: [
				{
					id: "e1",
					title: "Dune (fr)",
					publisher: { id: "pub", name: "Pocket" },
					translators: [
						{ entityId: "t1", name: "Michel Demuth", creditedAs: null },
						{ entityId: "t2", name: "Someone", creditedAs: "M. D." },
					],
					language: "fr",
					pages: 830,
					type: "print",
					isbn: "978-2266320481",
					year: 2021,
					cover: "/images/reading-book/edition/e1?v=0a1b2c3d",
					modelId: "m1",
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
				},
			],
		});
	});

	it("lists the readings first read first, the ones not started yet last", () => {
		const reading = (id: string, date?: string) => ({
			id,
			status: "complete" as const,
			entries: date ? [{ chapterId: "c1", date, tags: [] }] : [],
		});
		const book = toBook({
			...row,
			editions: [
				{
					...edition,
					readings: [reading("new"), reading("second", "2025-01-01"), reading("first", "2024-01-01")],
				},
			],
		});
		expect(book.editions[0].readings.map(({ id }) => id)).toEqual(["first", "second", "new"]);
	});

	it("gives empty strings for a missing original language or country, and no cover without key", () => {
		const book = toBook({
			...row,
			originalLanguage: null,
			country: null,
			models: [],
			editions: [{ ...edition, coverKey: null, publisher: null }],
		});
		expect(book).toMatchObject({ originalLanguage: "", country: "", models: [] });
		expect(book.editions[0]).toMatchObject({ cover: null, publisher: null });
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
