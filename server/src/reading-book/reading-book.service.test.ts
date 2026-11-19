import { describe, expect, it, vi } from "vitest";

import type { ContextTagsRepository } from "../context-tags/context-tags.repository.js";
import type { BookRepository } from "./book.repository.js";
import type { CoverStorage } from "./cover.storage.js";

import { BadRequestError, ConflictError, NotFoundError } from "../common/errors.js";
import { ReadingBookService } from "./reading-book.service.js";

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
		findSeries: vi.fn().mockResolvedValue(undefined),
		findAllSeries: vi.fn().mockResolvedValue([]),
		findAllSeriesItems: vi.fn().mockResolvedValue([]),
		countBooks: vi.fn((ids: string[]) => Promise.resolve(new Set(ids).size)),
		countSeries: vi.fn((ids: string[]) => Promise.resolve(new Set(ids).size)),
		saveSeries: vi.fn().mockResolvedValue("series-1"),
		deleteSeries: vi.fn().mockResolvedValue(undefined),
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
const buildService = (repo: FakeRepo, covers: unknown = {}, contextTags: unknown = {}) =>
	new ReadingBookService(asRepo(repo), covers as CoverStorage, contextTags as ContextTagsRepository);

describe("ReadingBookService.listBooks", () => {
	it("defaults to sorting by lastReadDate desc", () => {
		const repo = fakeRepo();
		buildService(repo).listBooks({ withReadingsDetails: false } as any);

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
		buildService(repo).listBooks({
			sort: ["book", "asc"],
			from: "2024-01-01",
			to: "2024-12-31",
			withReadingsDetails: true,
		} as any);

		expect(repo.findAll).toHaveBeenCalledWith({
			from: "2024-01-01",
			to: "2024-12-31",
			withReadingsDetails: true,
			sortField: "book",
			sortDirection: "asc",
		});
	});
});

describe("ReadingBookService.getBook", () => {
	it("looks the book up by id", () => {
		const repo = fakeRepo();
		buildService(repo).getBook("book-1");
		expect(repo.findById).toHaveBeenCalledWith("book-1");
	});
});

describe("ReadingBookService.saveBook", () => {
	it("updates an existing book and returns the reloaded document", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: "book-1", book: "Dune" });
		const book = { id: "book-1", book: "Dune", authors: [{ entityId: "herbert", creditedAs: null }] };

		const result = await buildService(repo).saveBook(book as any);

		expect(repo.update).toHaveBeenCalledWith("book-1", book);
		expect(repo.insert).not.toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith("book-1");
		expect(result).toEqual({ id: "book-1", book: "Dune" });
	});

	it("refuses an author who isn't a known person", async () => {
		const repo = fakeRepo();
		repo.countEntities.mockResolvedValue(0);
		const book = { book: "Dune", authors: [{ entityId: "folio", creditedAs: null }] };

		await expect(buildService(repo).saveBook(book as any)).rejects.toBeInstanceOf(BadRequestError);
		expect(repo.countEntities).toHaveBeenCalledWith(["folio"], ["person"]);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("inserts a new book with a generated id", async () => {
		const repo = fakeRepo();
		const book = { book: "Dune", authors: [{ entityId: "herbert", creditedAs: null }] };

		await buildService(repo).saveBook(book as any);

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).toHaveBeenCalledWith(expect.any(String), book);
		// the reloaded book uses the same generated id
		expect(repo.findById).toHaveBeenCalledWith(repo.insert.mock.calls[0][0]);
	});
});

describe("ReadingBookService.getAuthor", () => {
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

		expect(await buildService(repo).getAuthor("carroll")).toEqual({
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

	it("404s on an unknown entity", async () => {
		const repo = fakeRepo();
		await expect(buildService(repo).getAuthor("nobody")).rejects.toBeInstanceOf(NotFoundError);
		expect(repo.findAll).not.toHaveBeenCalled();
	});
});

// Terre du Milieu: 1. Bilbo, 2. Le Seigneur des anneaux (1. Communauté)
const SERIES = [
	{ id: "lotr", title: "Le Seigneur des anneaux" },
	{ id: "middle-earth", title: "Terre du Milieu" },
];
const SERIES_ITEMS = [
	{ seriesId: "middle-earth", position: 1, positionLabel: "1", bookId: "hobbit", childSeriesId: null },
	{ seriesId: "middle-earth", position: 2, positionLabel: "2", bookId: null, childSeriesId: "lotr" },
	{ seriesId: "lotr", position: 1, positionLabel: "1", bookId: "fellowship", childSeriesId: null },
];
function seriesRepo() {
	const repo = fakeRepo();
	repo.findAllSeries.mockResolvedValue(SERIES);
	repo.findAllSeriesItems.mockResolvedValue(SERIES_ITEMS);
	return repo;
}

describe("ReadingBookService.listSeries", () => {
	it("counts the books of the whole tree and gives the parents", async () => {
		expect(await buildService(seriesRepo()).listSeries()).toEqual([
			{
				id: "lotr",
				title: "Le Seigneur des anneaux",
				nbBooks: 1,
				parents: [{ id: "middle-earth", title: "Terre du Milieu" }],
			},
			{ id: "middle-earth", title: "Terre du Milieu", nbBooks: 2, parents: [] },
		]);
	});
});

describe("ReadingBookService.getSeries", () => {
	it("gives the tree, the books of every level loaded at once and numbered in reading order", async () => {
		const repo = seriesRepo();
		repo.findSeries.mockResolvedValue({ id: "middle-earth", title: "Terre du Milieu" });
		repo.findAll.mockResolvedValue([{ id: "fellowship" }, { id: "hobbit" }]);

		expect(await buildService(repo).getSeries("middle-earth")).toEqual({
			id: "middle-earth",
			title: "Terre du Milieu",
			parents: [],
			items: [
				{ kind: "book", positionLabel: "1", readingOrder: 1, book: { id: "hobbit" } },
				{
					kind: "series",
					positionLabel: "2",
					series: { id: "lotr", title: "Le Seigneur des anneaux" },
					items: [{ kind: "book", positionLabel: "1", readingOrder: 2, book: { id: "fellowship" } }],
				},
			],
		});
		expect(repo.findAll).toHaveBeenCalledWith({ withReadingsDetails: false, bookIds: ["hobbit", "fellowship"] });
	});

	it("doesn't load the books of an empty series", async () => {
		const repo = seriesRepo();
		repo.findSeries.mockResolvedValue({ id: "empty", title: "Vide" });
		expect(await buildService(repo).getSeries("empty")).toMatchObject({
			items: [],
		});
		expect(repo.findAll).not.toHaveBeenCalled();
	});

	it("404s on an unknown series", async () => {
		const repo = seriesRepo();
		await expect(buildService(repo).getSeries("nope")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ReadingBookService.saveSeries", () => {
	const series = {
		title: "Terre du Milieu",
		items: [
			{ kind: "book" as const, bookId: "hobbit", positionLabel: "1" },
			{ kind: "series" as const, seriesId: "lotr", positionLabel: "2" },
		],
	};

	it("saves the series and gives its id", async () => {
		const repo = seriesRepo();
		expect(await buildService(repo).saveSeries(series)).toEqual({ id: "series-1" });
		expect(repo.saveSeries).toHaveBeenCalledWith(series);
	});

	it("refuses a book or a sub-series listed twice", async () => {
		const repo = seriesRepo();
		for (const twice of [series.items[0], series.items[1]]) {
			await expect(
				buildService(repo).saveSeries({ ...series, items: [...series.items, twice] }),
			).rejects.toBeInstanceOf(BadRequestError);
		}
		expect(repo.saveSeries).not.toHaveBeenCalled();
	});

	it("refuses an unknown book or sub-series", async () => {
		for (const unknown of ["countBooks", "countSeries"] as const) {
			const repo = seriesRepo();
			repo[unknown].mockResolvedValue(0);
			await expect(buildService(repo).saveSeries(series)).rejects.toBeInstanceOf(BadRequestError);
		}
	});

	it("refuses a series holding itself, through a sub-series", async () => {
		const repo = seriesRepo();
		// Le Seigneur des anneaux holding Terre du Milieu, which holds it
		await expect(
			buildService(repo).saveSeries({
				id: "lotr",
				title: "Le Seigneur des anneaux",
				items: [{ kind: "series", seriesId: "middle-earth", positionLabel: null }],
			}),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(repo.saveSeries).not.toHaveBeenCalled();
	});

	it("404s on an unknown series", async () => {
		const repo = seriesRepo();
		repo.saveSeries.mockResolvedValue(undefined);
		await expect(buildService(repo).saveSeries({ ...series, id: "nope" })).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ReadingBookService.deleteSeries", () => {
	it("deletes a series", async () => {
		const repo = fakeRepo();
		repo.findSeries.mockResolvedValue({ id: "s1", title: "Percy Jackson" });
		await buildService(repo).deleteSeries("s1");
		expect(repo.deleteSeries).toHaveBeenCalledWith("s1");
	});

	it("404s on an unknown series", async () => {
		const repo = fakeRepo();
		await expect(buildService(repo).deleteSeries("nope")).rejects.toBeInstanceOf(NotFoundError);
		expect(repo.deleteSeries).not.toHaveBeenCalled();
	});
});

describe("ReadingBookService.saveModel", () => {
	it("saves the model of the book", async () => {
		const repo = fakeRepo();
		const model = { name: "VO", tree: [{ id: "c1", title: "Part 1" }] };
		await buildService(repo).saveModel("book-1", model);
		expect(repo.saveModel).toHaveBeenCalledWith("book-1", model);
	});

	it("404s on an unknown book or model", async () => {
		const repo = fakeRepo();
		repo.saveModel.mockResolvedValue(false);
		await expect(buildService(repo).saveModel("book-1", { id: "m1", name: "VO", tree: [] })).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});
});

describe("ReadingBookService.deleteModel", () => {
	const ids = { bookId: "book-1", modelId: "m1" };

	it("deletes a model no read edition uses", async () => {
		const repo = fakeRepo();
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 0 });
		await buildService(repo).deleteModel(ids.bookId, ids.modelId);
		expect(repo.deleteModel).toHaveBeenCalledWith("book-1", "m1");
	});

	it("refuses a model used by an edition with readings", async () => {
		const repo = fakeRepo();
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 1 });
		await expect(buildService(repo).deleteModel(ids.bookId, ids.modelId)).rejects.toBeInstanceOf(ConflictError);
		expect(repo.deleteModel).not.toHaveBeenCalled();
	});

	it("404s on an unknown model", async () => {
		const repo = fakeRepo();
		await expect(buildService(repo).deleteModel(ids.bookId, ids.modelId)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ReadingBookService.addReading", () => {
	it("starts a fresh in-progress reading on the edition", async () => {
		const repo = fakeRepo();
		await buildService(repo).addReading("book-1", "ed-1");

		const [bookId, editionId, reading] = repo.pushReading.mock.calls[0];
		expect([bookId, editionId]).toEqual(["book-1", "ed-1"]);
		expect(reading).toMatchObject({ status: "in-progress", details: [] });
	});

	it("404s when the book has no such edition", async () => {
		const repo = fakeRepo();
		repo.pushReading.mockResolvedValue(false);
		await expect(buildService(repo).addReading("book-1", "ed-1")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ReadingBookService.saveEdition", () => {
	const OLD_KEY = "personal-tracker/reading-book/edition/ed-1.old.avif";
	const NEW_KEY = "personal-tracker/reading-book/edition/ed-1.new.avif";
	const fields = {
		title: null,
		publisherId: null,
		collection: null,
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
		const service = buildService(repo, covers);
		return { repo, covers, service };
	}

	it("creates an edition with a new id and uploads its cover", async () => {
		const { repo, covers, service } = build();
		await service.saveEdition("book-1", { ...fields, cover: "https://example.com/c.jpg" });

		const [bookId, isNew, saved] = repo.saveEdition.mock.calls[0];
		expect([bookId, isNew]).toEqual(["book-1", true]);
		expect(saved).toEqual({ ...fields, id: expect.any(String), coverKey: NEW_KEY });
		expect(covers.upload).toHaveBeenCalledWith(saved.id, "https://example.com/c.jpg");
	});

	it("keeps the cover when the form sends back the server's URL", async () => {
		const { repo, covers, service } = build({ coverKey: OLD_KEY });
		await service.saveEdition("book-1", {
			...fields,
			id: "ed-1",
			cover: "/images/reading-book/edition/ed-1?v=old",
		});

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: OLD_KEY });
		expect(covers.upload).not.toHaveBeenCalled();
		expect(covers.deleteObject).not.toHaveBeenCalled();
	});

	it("replaces the cover and deletes the former one", async () => {
		const { repo, covers, service } = build({ coverKey: OLD_KEY });
		await service.saveEdition("book-1", { ...fields, id: "ed-1", cover: "data:image/png;base64,AAAA" });

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: NEW_KEY });
		expect(covers.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("removes the cover", async () => {
		const { repo, covers, service } = build({ coverKey: OLD_KEY });
		await service.saveEdition("book-1", { ...fields, id: "ed-1", cover: null });

		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ coverKey: null });
		expect(covers.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("refuses a publisher that isn't a known organization", async () => {
		const { repo, service } = build();
		repo.countEntities.mockResolvedValue(0);
		await expect(
			service.saveEdition("book-1", { ...fields, publisherId: "herbert", cover: null }),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(repo.countEntities).toHaveBeenCalledWith(["herbert"], ["organization"]);
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("refuses a model of another book", async () => {
		const { repo, service } = build();
		await expect(service.saveEdition("book-1", { ...fields, modelId: "m2", cover: null })).rejects.toBeInstanceOf(
			BadRequestError,
		);
		expect(repo.findModel).toHaveBeenCalledWith("book-1", "m2");
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("refuses to change the model of an edition with readings", async () => {
		const { repo, service } = build({ coverKey: null, modelId: "m1", nbReadings: 1 });
		repo.findModel.mockResolvedValue({ id: "m2", nbReadEditions: 0 });
		await expect(
			service.saveEdition("book-1", { ...fields, id: "ed-1", modelId: "m2", cover: null }),
		).rejects.toBeInstanceOf(ConflictError);
		expect(repo.saveEdition).not.toHaveBeenCalled();
	});

	it("keeps the model of an edition with readings", async () => {
		const { repo, service } = build({ coverKey: null, modelId: "m1", nbReadings: 1 });
		repo.findModel.mockResolvedValue({ id: "m1", nbReadEditions: 1 });
		await service.saveEdition("book-1", { ...fields, id: "ed-1", modelId: "m1", pages: 300, cover: null });
		expect(repo.saveEdition.mock.calls[0][2]).toMatchObject({ modelId: "m1", pages: 300 });
	});

	it("404s on an unknown edition, before uploading anything", async () => {
		const { covers, service } = build();
		await expect(
			service.saveEdition("book-1", { ...fields, id: "ed-1", cover: "https://example.com/c.jpg" }),
		).rejects.toBeInstanceOf(NotFoundError);
		expect(covers.upload).not.toHaveBeenCalled();
	});

	it("deletes the uploaded cover when the book doesn't exist", async () => {
		const { repo, covers, service } = build();
		repo.saveEdition.mockResolvedValue(false);
		await expect(
			service.saveEdition("book-1", { ...fields, cover: "https://example.com/c.jpg" }),
		).rejects.toBeInstanceOf(NotFoundError);
		expect(covers.deleteObject).toHaveBeenCalledWith(NEW_KEY);
	});
});

describe("ReadingBookService.deleteEdition", () => {
	function build(edition?: { nbReadings: number; nbBookEditions: number; coverKey: string | null }) {
		const repo = fakeRepo();
		repo.findEdition.mockResolvedValue(edition && { id: "ed-1", ...edition });
		const covers = { deleteObject: vi.fn().mockResolvedValue(undefined) };
		const service = buildService(repo, covers);
		return { repo, covers, service };
	}
	const ids = { bookId: "book-1", editionId: "ed-1" };

	it("deletes the edition and its cover", async () => {
		const { repo, covers, service } = build({ nbReadings: 0, nbBookEditions: 2, coverKey: "key" });
		await service.deleteEdition(ids.bookId, ids.editionId);
		expect(repo.deleteEdition).toHaveBeenCalledWith("book-1", "ed-1");
		expect(covers.deleteObject).toHaveBeenCalledWith("key");
	});

	it("refuses an edition with readings", async () => {
		const { repo, service } = build({ nbReadings: 1, nbBookEditions: 2, coverKey: null });
		await expect(service.deleteEdition(ids.bookId, ids.editionId)).rejects.toBeInstanceOf(ConflictError);
		expect(repo.deleteEdition).not.toHaveBeenCalled();
	});

	it("refuses the book's last edition", async () => {
		const { repo, service } = build({ nbReadings: 0, nbBookEditions: 1, coverKey: null });
		await expect(service.deleteEdition(ids.bookId, ids.editionId)).rejects.toBeInstanceOf(ConflictError);
		expect(repo.deleteEdition).not.toHaveBeenCalled();
	});

	it("404s on an unknown edition", async () => {
		const { service } = build();
		await expect(service.deleteEdition(ids.bookId, ids.editionId)).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ReadingBookService.saveReading", () => {
	it("forwards the reading to the repository", () => {
		const repo = fakeRepo();
		const reading = { id: "r1", status: "complete", details: [] };
		buildService(repo).saveReading("book-1", reading as any);
		expect(repo.updateReading).toHaveBeenCalledWith("book-1", reading);
	});
});

describe("ReadingBookService.deleteReading", () => {
	it("forwards book and reading ids to the repository", () => {
		const repo = fakeRepo();
		buildService(repo).deleteReading("book-1", "reading-1");
		expect(repo.deleteReading).toHaveBeenCalledWith("book-1", "reading-1");
	});
});

describe("ReadingBookService.report", () => {
	const from = "2024-01-01";
	const to = "2024-12-31";

	function build(books: unknown, tagGroups: unknown = []) {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue(books);
		const contextTagRepo = { findAll: vi.fn().mockResolvedValue(tagGroups) };
		const service = buildService(repo, {}, contextTagRepo);
		return { service, repo, contextTagRepo };
	}

	it("requests the full range with reading details", async () => {
		const { service, repo } = build([]);
		await service.report({ from, to });
		expect(repo.findAll).toHaveBeenCalledWith({
			from,
			to,
			withReadingsDetails: true,
			sortField: "name",
			sortDirection: "asc",
		});
	});

	it("returns an empty report when there are no books", async () => {
		const { service } = build([]);
		expect(await service.report({ from, to })).toEqual({
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
		const { service } = build(books, [{ name: "Genre", tags: ["scifi", "fantasy"] }]);

		expect(await service.report({ from, to })).toEqual({
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
		const { service } = build(books);

		const report = await service.report({ from, to });
		expect(report.statusDistribution).toEqual([{ name: "in-progress", books: 1, averageDays: 2, medianDays: 2 }]);
		// status never became "complete", so the author has 0 completed books
		expect(report.authorDistribution).toEqual([{ name: "Bob", books: 0, chapters: 1, days: 1 }]);
	});
});
