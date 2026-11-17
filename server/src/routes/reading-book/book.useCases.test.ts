import { describe, expect, it, vi } from "vitest";

import type { ContextTagRepository } from "../context-tags/context-tag.repository";
import type { BookRepository } from "./book.repository";
import type { CoverStorageRepository } from "./cover-storage.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import {
	AddReadingUseCase,
	DeleteEditionUseCase,
	DeleteModelUseCase,
	DeleteReadingUseCase,
	GetBookUseCase,
	GetReportUseCase,
	GetAuthorUseCase,
	ListBooksUseCase,
	SaveBookUseCase,
	SaveEditionUseCase,
	SaveModelUseCase,
	SaveReadingUseCase,
} from "./book.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		findModel: vi.fn().mockResolvedValue(undefined),
		saveModel: vi.fn().mockResolvedValue(true),
		deleteModel: vi.fn().mockResolvedValue(undefined),
		// every credited entity exists with the expected kind
		countEntities: vi.fn((ids: string[]) => Promise.resolve(new Set(ids).size)),
		findAuthors: vi.fn().mockResolvedValue([]),
		findEntity: vi.fn().mockResolvedValue(undefined),
		pushReading: vi.fn().mockResolvedValue(true),
		findEdition: vi.fn().mockResolvedValue(undefined),
		saveEdition: vi.fn().mockResolvedValue(true),
		deleteEdition: vi.fn().mockResolvedValue(undefined),
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
		const book = { id: "book-1", book: "Dune", authors: [{ entityId: "herbert", creditedAs: null }] };

		const result = await new SaveBookUseCase(asRepo(repo)).execute(book as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("book-1", book);
		expect(repo.insert).not.toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith("book-1");
		expect(result).toEqual({ id: "book-1", book: "Dune" });
	});

	it("refuses an author who isn't a known person", async () => {
		const repo = fakeRepo();
		repo.countEntities.mockResolvedValue(0);
		const book = { book: "Dune", authors: [{ entityId: "folio", creditedAs: null }] };

		await expect(new SaveBookUseCase(asRepo(repo)).execute(book as any, asLog(makeLog()))).rejects.toMatchObject({
			statusCode: 400,
		});
		expect(repo.countEntities).toHaveBeenCalledWith(["folio"], ["person"]);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("inserts a new book with a generated id", async () => {
		const repo = fakeRepo();
		const book = { book: "Dune", authors: [{ entityId: "herbert", creditedAs: null }] };

		await new SaveBookUseCase(asRepo(repo)).execute(book as any, asLog(makeLog()));

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).toHaveBeenCalledWith(expect.any(String), book);
		// the reloaded book uses the same generated id
		expect(repo.findById).toHaveBeenCalledWith(repo.insert.mock.calls[0][0]);
	});
});

describe("GetAuthorUseCase", () => {
	it("gives the author with their books, in publication order", async () => {
		const repo = fakeRepo();
		repo.findEntity.mockResolvedValue({
			id: "carroll",
			kind: "person",
			name: "Lewis Carroll",
			sortName: null,
			pictureKey: "personal-tracker/entity/carroll.0a1b2c3d.avif",
		});
		repo.findAll.mockResolvedValue([{ id: "alice" }]);

		expect(await new GetAuthorUseCase(asRepo(repo)).execute("carroll", asLog(makeLog()))).toEqual({
			id: "carroll",
			kind: "person",
			name: "Lewis Carroll",
			sortName: null,
			picture: "/images/entity/carroll?v=0a1b2c3d",
			books: [{ id: "alice" }],
		});
		expect(repo.findAll).toHaveBeenCalledWith({
			withReadingsDetails: false,
			authorId: "carroll",
			sortField: "originalYear",
			sortDirection: "asc",
		});
	});

	it("is undefined for an unknown entity", async () => {
		const repo = fakeRepo();
		expect(await new GetAuthorUseCase(asRepo(repo)).execute("nobody", asLog(makeLog()))).toBeUndefined();
		expect(repo.findAll).not.toHaveBeenCalled();
	});
});

describe("SaveModelUseCase", () => {
	it("saves the model of the book", async () => {
		const repo = fakeRepo();
		const model = { name: "VO", tree: [{ id: "c1", title: "Part 1" }] };
		await new SaveModelUseCase(asRepo(repo)).execute({ bookId: "book-1", model }, asLog(makeLog()));
		expect(repo.saveModel).toHaveBeenCalledWith("book-1", model);
	});

	it("404s on an unknown book or model", async () => {
		const repo = fakeRepo();
		repo.saveModel.mockResolvedValue(false);
		await expect(
			new SaveModelUseCase(asRepo(repo)).execute(
				{ bookId: "book-1", model: { id: "m1", name: "VO", tree: [] } },
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});

describe("DeleteModelUseCase", () => {
	const ids = { bookId: "book-1", modelId: "m1" };

	it("deletes a model no read edition uses", async () => {
		const repo = fakeRepo();
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 0 });
		await new DeleteModelUseCase(asRepo(repo)).execute(ids, asLog(makeLog()));
		expect(repo.deleteModel).toHaveBeenCalledWith("book-1", "m1");
	});

	it("refuses a model used by an edition with readings", async () => {
		const repo = fakeRepo();
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 1 });
		await expect(new DeleteModelUseCase(asRepo(repo)).execute(ids, asLog(makeLog()))).rejects.toMatchObject({
			statusCode: 409,
		});
		expect(repo.deleteModel).not.toHaveBeenCalled();
	});

	it("404s on an unknown model", async () => {
		const repo = fakeRepo();
		await expect(new DeleteModelUseCase(asRepo(repo)).execute(ids, asLog(makeLog()))).rejects.toMatchObject({
			statusCode: 404,
		});
	});
});

describe("AddReadingUseCase", () => {
	it("starts a fresh in-progress reading on the edition", async () => {
		const repo = fakeRepo();
		await new AddReadingUseCase(asRepo(repo)).execute({ bookId: "book-1", editionId: "ed-1" }, asLog(makeLog()));

		const [bookId, editionId, reading] = repo.pushReading.mock.calls[0];
		expect([bookId, editionId]).toEqual(["book-1", "ed-1"]);
		expect(reading).toMatchObject({ status: "in-progress", details: [] });
	});

	it("404s when the book has no such edition", async () => {
		const repo = fakeRepo();
		repo.pushReading.mockResolvedValue(false);
		await expect(
			new AddReadingUseCase(asRepo(repo)).execute({ bookId: "book-1", editionId: "ed-1" }, asLog(makeLog())),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});

describe("SaveEditionUseCase", () => {
	const OLD_KEY = "personal-tracker/reading-book/edition/ed-1.old.avif";
	const NEW_KEY = "personal-tracker/reading-book/edition/ed-1.new.avif";
	const fields = {
		title: null,
		publisherId: null,
		translators: [],
		language: "fr",
		pages: 200,
		type: "print" as const,
		isbn: null,
		year: null,
		modelId: null,
	};

	function build(current?: { coverKey: string | null; modelId?: string | null; nbReadings?: number }) {
		const repo = fakeRepo();
		repo.findEdition.mockResolvedValue(
			current && { id: "ed-1", nbReadings: 0, nbBookEditions: 1, modelId: null, ...current },
		);
		const covers = {
			isOwnUrl: (value: string) => value.startsWith("/images/reading-book/edition/"),
			upload: vi.fn().mockResolvedValue(NEW_KEY),
			deleteObject: vi.fn().mockResolvedValue(undefined),
		};
		const useCase = new SaveEditionUseCase(asRepo(repo), covers as unknown as CoverStorageRepository);
		return { repo, covers, useCase };
	}

	it("creates an edition with a new id and uploads its cover", async () => {
		const { repo, covers, useCase } = build();
		await useCase.execute(
			{ bookId: "book-1", edition: { ...fields, cover: "https://example.com/c.jpg" } },
			asLog(makeLog()),
		);

		const [bookId, isNew, saved] = repo.saveEdition.mock.calls[0];
		expect([bookId, isNew]).toEqual(["book-1", true]);
		expect(saved).toEqual({ ...fields, id: expect.any(String), coverKey: NEW_KEY });
		expect(covers.upload).toHaveBeenCalledWith(saved.id, "https://example.com/c.jpg");
	});

	it("keeps the cover when the form sends back the server's URL", async () => {
		const { repo, covers, useCase } = build({ coverKey: OLD_KEY });
		await useCase.execute(
			{ bookId: "book-1", edition: { ...fields, id: "ed-1", cover: "/images/reading-book/edition/ed-1?v=old" } },
			asLog(makeLog()),
		);

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: OLD_KEY });
		expect(covers.upload).not.toHaveBeenCalled();
		expect(covers.deleteObject).not.toHaveBeenCalled();
	});

	it("replaces the cover and deletes the former one", async () => {
		const { repo, covers, useCase } = build({ coverKey: OLD_KEY });
		await useCase.execute(
			{ bookId: "book-1", edition: { ...fields, id: "ed-1", cover: "data:image/png;base64,AAAA" } },
			asLog(makeLog()),
		);

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: NEW_KEY });
		expect(covers.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("removes the cover", async () => {
		const { repo, covers, useCase } = build({ coverKey: OLD_KEY });
		await useCase.execute({ bookId: "book-1", edition: { ...fields, id: "ed-1", cover: null } }, asLog(makeLog()));

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: null });
		expect(covers.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("refuses a publisher that isn't a known organization", async () => {
		const { repo, useCase } = build();
		repo.countEntities.mockResolvedValue(0);
		await expect(
			useCase.execute(
				{ bookId: "book-1", edition: { ...fields, publisherId: "herbert", cover: null } },
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(repo.countEntities).toHaveBeenCalledWith(["herbert"], ["organization"]);
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("refuses a model of another book", async () => {
		const { repo, useCase } = build();
		await expect(
			useCase.execute({ bookId: "book-1", edition: { ...fields, modelId: "m2", cover: null } }, asLog(makeLog())),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(repo.findModel).toHaveBeenCalledWith("book-1", "m2");
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("refuses to change the model of an edition with readings", async () => {
		const { repo, useCase } = build({ coverKey: null, modelId: "m1", nbReadings: 1 });
		repo.findModel.mockResolvedValue({ id: "m2", nbReadEditions: 0 });
		await expect(
			useCase.execute(
				{ bookId: "book-1", edition: { ...fields, id: "ed-1", modelId: "m2", cover: null } },
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 409 });
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("keeps the model of an edition with readings", async () => {
		const { repo, useCase } = build({ coverKey: null, modelId: "m1", nbReadings: 1 });
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 1 });
		await useCase.execute(
			{ bookId: "book-1", edition: { ...fields, id: "ed-1", modelId: "m1", pages: 300, cover: null } },
			asLog(makeLog()),
		);
		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ modelId: "m1", pages: 300 });
	});

	it("404s on an unknown edition, before uploading anything", async () => {
		const { covers, useCase } = build();
		await expect(
			useCase.execute(
				{ bookId: "book-1", edition: { ...fields, id: "ed-1", cover: "https://example.com/c.jpg" } },
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 404 });
		expect(covers.upload).not.toHaveBeenCalled();
	});

	it("deletes the uploaded cover when the book doesn't exist", async () => {
		const { repo, covers, useCase } = build();
		repo.saveEdition.mockResolvedValue(false);
		await expect(
			useCase.execute(
				{ bookId: "book-1", edition: { ...fields, cover: "https://example.com/c.jpg" } },
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 404 });
		expect(covers.deleteObject).toHaveBeenCalledWith(NEW_KEY);
	});
});

describe("DeleteEditionUseCase", () => {
	function build(edition?: { nbReadings: number; nbBookEditions: number; coverKey: string | null }) {
		const repo = fakeRepo();
		repo.findEdition.mockResolvedValue(edition && { id: "ed-1", ...edition });
		const covers = { deleteObject: vi.fn().mockResolvedValue(undefined) };
		const useCase = new DeleteEditionUseCase(asRepo(repo), covers as unknown as CoverStorageRepository);
		return { repo, covers, useCase };
	}
	const ids = { bookId: "book-1", editionId: "ed-1" };

	it("deletes the edition and its cover", async () => {
		const { repo, covers, useCase } = build({ nbReadings: 0, nbBookEditions: 2, coverKey: "key" });
		await useCase.execute(ids, asLog(makeLog()));
		expect(repo.deleteEdition).toHaveBeenCalledWith("book-1", "ed-1");
		expect(covers.deleteObject).toHaveBeenCalledWith("key");
	});

	it("refuses an edition with readings", async () => {
		const { repo, useCase } = build({ nbReadings: 1, nbBookEditions: 2, coverKey: null });
		await expect(useCase.execute(ids, asLog(makeLog()))).rejects.toMatchObject({ statusCode: 409 });
		expect(repo.deleteEdition).not.toHaveBeenCalled();
	});

	it("refuses the book's last edition", async () => {
		const { repo, useCase } = build({ nbReadings: 0, nbBookEditions: 1, coverKey: null });
		await expect(useCase.execute(ids, asLog(makeLog()))).rejects.toMatchObject({ statusCode: 409 });
		expect(repo.deleteEdition).not.toHaveBeenCalled();
	});

	it("404s on an unknown edition", async () => {
		const { useCase } = build();
		await expect(useCase.execute(ids, asLog(makeLog()))).rejects.toMatchObject({ statusCode: 404 });
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
				authors: [{ entityId: "a", name: "Alice", creditedAs: null }],
				readings: [
					{
						language: "en",
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
				authors: [{ entityId: "b", name: "Bob", creditedAs: null }],
				readings: [
					{
						language: "fr",
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
