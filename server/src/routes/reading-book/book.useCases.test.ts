import { describe, expect, it, vi } from "vitest";

import type { ContextTagRepository } from "../context-tags/context-tag.repository";
import type { BookRepository } from "./book.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import {
	AddReadingUseCase,
	DeleteReadingUseCase,
	GetBookUseCase,
	GetReportUseCase,
	ListBooksUseCase,
	SaveBookUseCase,
	SaveModelUseCase,
	SaveReadingUseCase,
} from "./book.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		updateModel: vi.fn().mockResolvedValue({ acknowledged: true }),
		pushReading: vi.fn().mockResolvedValue({ acknowledged: true }),
		updateReading: vi.fn().mockResolvedValue({ acknowledged: true }),
		deleteReading: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

type FakeRepo = ReturnType<typeof fakeRepo>;
const asRepo = (r: FakeRepo) => r as unknown as BookRepository;

describe("ListBooksUseCase", () => {
	it("defaults to sorting by lastReadDate desc", () => {
		const repo = fakeRepo();
		new ListBooksUseCase(asRepo(repo)).execute({ withReadingsDetails: false } as any, asLog(makeLog()));

		expect(repo.findAll).toHaveBeenCalledWith({
			from: undefined,
			to: undefined,
			withReadingsDetails: false,
			sortField: "lastReadDate",
			sortDirection: "desc",
		});
	});

	it("passes through the requested sort and date range", () => {
		const repo = fakeRepo();
		new ListBooksUseCase(asRepo(repo)).execute(
			{
				sort: ["book", "asc"],
				from: "2024-01-01",
				to: "2024-12-31",
				withReadingsDetails: true,
			} as any,
			asLog(makeLog()),
		);

		expect(repo.findAll).toHaveBeenCalledWith({
			from: "2024-01-01",
			to: "2024-12-31",
			withReadingsDetails: true,
			sortField: "book",
			sortDirection: "asc",
		});
	});
});

describe("GetBookUseCase", () => {
	it("looks the book up by id", () => {
		const repo = fakeRepo();
		new GetBookUseCase(asRepo(repo)).execute("book-1", asLog(makeLog()));
		expect(repo.findById).toHaveBeenCalledWith("book-1");
	});
});

describe("SaveBookUseCase", () => {
	it("updates an existing book and returns the reloaded document", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: "book-1", book: "Dune" });
		const book = { id: "book-1", book: "Dune", author: ["Herbert"] };

		const result = await new SaveBookUseCase(asRepo(repo)).execute(book as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("book-1", book);
		expect(repo.insert).not.toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith("book-1");
		expect(result).toEqual({ id: "book-1", book: "Dune" });
	});

	it("inserts a new book with a generated id and empty readings/model", async () => {
		const repo = fakeRepo();
		const book = { book: "Dune", author: ["Herbert"] };

		await new SaveBookUseCase(asRepo(repo)).execute(book as any, asLog(makeLog()));

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).toHaveBeenCalledTimes(1);
		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ book: "Dune", author: ["Herbert"], readings: [], model: [] });
		expect(inserted.id).toEqual(expect.any(String));
		// the reloaded document uses the same generated id
		expect(repo.findById).toHaveBeenCalledWith(inserted.id);
	});
});

describe("SaveModelUseCase", () => {
	it("forwards the model to the repository", () => {
		const repo = fakeRepo();
		const model = [{ id: "m1", title: "Part 1" }];
		new SaveModelUseCase(asRepo(repo)).execute({ bookId: "book-1", model: model as any }, asLog(makeLog()));
		expect(repo.updateModel).toHaveBeenCalledWith("book-1", model);
	});

	it("throws when the book id is missing", () => {
		const repo = fakeRepo();
		expect(() =>
			new SaveModelUseCase(asRepo(repo)).execute({ bookId: "", model: [] as any }, asLog(makeLog())),
		).toThrow("Book ID is required");
		expect(repo.updateModel).not.toHaveBeenCalled();
	});
});

describe("AddReadingUseCase", () => {
	it("pushes a fresh in-progress reading", () => {
		const repo = fakeRepo();
		new AddReadingUseCase(asRepo(repo)).execute("book-1", asLog(makeLog()));

		expect(repo.pushReading).toHaveBeenCalledTimes(1);
		const [bookId, reading] = repo.pushReading.mock.calls[0];
		expect(bookId).toBe("book-1");
		expect(reading).toMatchObject({ status: "in-progress", details: [] });
	});

	it("throws when the book id is missing", () => {
		const repo = fakeRepo();
		expect(() => new AddReadingUseCase(asRepo(repo)).execute("", asLog(makeLog()))).toThrow("Book ID is required");
	});
});

describe("SaveReadingUseCase", () => {
	it("forwards the reading to the repository", () => {
		const repo = fakeRepo();
		const reading = { id: "r1", status: "complete", details: [] };
		new SaveReadingUseCase(asRepo(repo)).execute({ bookId: "book-1", reading: reading as any }, asLog(makeLog()));
		expect(repo.updateReading).toHaveBeenCalledWith("book-1", reading);
	});

	it("throws when the book id is missing", () => {
		const repo = fakeRepo();
		expect(() =>
			new SaveReadingUseCase(asRepo(repo)).execute({ bookId: "", reading: {} as any }, asLog(makeLog())),
		).toThrow("Book ID is required");
	});
});

describe("DeleteReadingUseCase", () => {
	it("forwards book and reading ids to the repository", () => {
		const repo = fakeRepo();
		new DeleteReadingUseCase(asRepo(repo)).execute({ bookId: "book-1", readingId: "reading-1" }, asLog(makeLog()));
		expect(repo.deleteReading).toHaveBeenCalledWith("book-1", "reading-1");
	});

	it("throws when the reading id is missing", () => {
		const repo = fakeRepo();
		expect(() =>
			new DeleteReadingUseCase(asRepo(repo)).execute({ bookId: "book-1", readingId: "" }, asLog(makeLog())),
		).toThrow("Reading ID is required");
	});
});

describe("GetReportUseCase", () => {
	const from = "2024-01-01";
	const to = "2024-12-31";

	function build(books: unknown, tagGroups: unknown = []) {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue(books);
		const contextTagRepo = { findAll: vi.fn().mockResolvedValue(tagGroups) };
		const useCase = new GetReportUseCase(asRepo(repo), contextTagRepo as unknown as ContextTagRepository);
		return { useCase, repo, contextTagRepo };
	}

	it("requests the full range with reading details", async () => {
		const { useCase, repo } = build([]);
		await useCase.execute({ from, to }, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({
			from,
			to,
			withReadingsDetails: true,
			sortField: "name",
			sortDirection: "asc",
		});
	});

	it("returns an empty report when there are no books", async () => {
		const { useCase } = build([]);
		expect(await useCase.execute({ from, to }, asLog(makeLog()))).toEqual({
			hasData: false,
			streakInfo: { days: 0, start: null, end: null },
			statusDistribution: [],
			tagDistribution: [],
			langDistribution: [],
			authorDistribution: [],
		});
	});

	it("aggregates chapters, tags, languages, authors and the reading streak", async () => {
		const books = [
			{
				author: ["Alice"],
				language: "en",
				readings: [
					{
						status: "complete",
						lastReadDate: "2024-06-10",
						readingDates: ["2024-06-01", "2024-06-02", "2024-06-10"],
						details: [
							{
								context: [
									{ date: "2024-06-01", tags: ["scifi"] },
									{ date: "2024-06-02", tags: ["fantasy", "noise"] },
								],
							},
							{ context: [{ date: "2024-06-10", tags: ["scifi"] }] },
						],
					},
				],
			},
		];
		const { useCase } = build(books, [{ name: "Genre", tags: ["scifi", "fantasy"] }]);

		expect(await useCase.execute({ from, to }, asLog(makeLog()))).toEqual({
			hasData: true,
			streakInfo: { days: 2, start: "2024-06-01", end: "2024-06-02" },
			statusDistribution: [{ name: "complete", books: 1, averageDays: 3, medianDays: 3 }],
			tagDistribution: [
				{ name: "Genre", chapters: 2, percent: 100 },
				{ name: "noise", chapters: 1, percent: 50 },
			],
			langDistribution: [{ name: "en", chapters: 2, percent: 100 }],
			authorDistribution: [{ name: "Alice", books: 1, chapters: 2, days: 3 }],
		});
	});

	it("reclassifies a reading completed after the period as in-progress", async () => {
		const books = [
			{
				author: "Bob",
				language: "fr",
				readings: [
					{
						status: "complete",
						lastReadDate: "2025-02-01",
						readingDates: ["2024-12-30", "2024-12-31"],
						details: [{ context: [{ date: "2024-12-31", tags: [] }] }],
					},
				],
			},
		];
		const { useCase } = build(books);

		const report = await useCase.execute({ from, to }, asLog(makeLog()));
		expect(report.statusDistribution).toEqual([{ name: "in-progress", books: 1, averageDays: 2, medianDays: 2 }]);
		// status never became "complete", so the author has 0 completed books
		expect(report.authorDistribution).toEqual([{ name: "Bob", books: 0, chapters: 1, days: 1 }]);
	});
});
