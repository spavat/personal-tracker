import { describe, expect, it, vi } from "vitest";

import type { MangaRepository } from "./manga.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { DeleteReadingUseCase, GetMangaUseCase, ListMangasUseCase, SaveMangaUseCase } from "./manga.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		updateReading: vi.fn().mockResolvedValue({ acknowledged: true }),
		pushReading: vi.fn().mockResolvedValue({ acknowledged: true }),
		deleteReading: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as MangaRepository;

describe("ListMangasUseCase", () => {
	it("defaults sort to name asc and forwards the filters", () => {
		const repo = fakeRepo();
		new ListMangasUseCase(asRepo(repo)).execute(
			{
				search: "one",
				from: "2024-01-01",
				to: "2024-12-31",
				withReadings: true,
			} as any,
			asLog(makeLog()),
		);

		expect(repo.findAll).toHaveBeenCalledWith({
			search: "one",
			from: "2024-01-01",
			to: "2024-12-31",
			withReadings: true,
			sortField: "name",
			sortDirection: "asc",
		});
	});

	it("passes an explicit sort tuple through", () => {
		const repo = fakeRepo();
		new ListMangasUseCase(asRepo(repo)).execute(
			{
				sort: ["lastReadingDate", "desc"],
				withReadings: false,
			} as any,
			asLog(makeLog()),
		);
		expect(repo.findAll.mock.calls[0][0]).toMatchObject({ sortField: "lastReadingDate", sortDirection: "desc" });
	});
});

describe("GetMangaUseCase", () => {
	it("looks the manga up by id", () => {
		const repo = fakeRepo();
		new GetMangaUseCase(asRepo(repo)).execute("manga-1", asLog(makeLog()));
		expect(repo.findById).toHaveBeenCalledWith("manga-1");
	});
});

describe("SaveMangaUseCase", () => {
	it("throws when both mangaId and manga.id are provided", async () => {
		const repo = fakeRepo();
		await expect(
			new SaveMangaUseCase(asRepo(repo)).execute({ mangaId: "m1", manga: { id: "m1" } } as any, asLog(makeLog())),
		).rejects.toThrow("Cannot provide both mangaId and manga.id");
	});

	it("updates an existing manga", async () => {
		const repo = fakeRepo();
		const manga = { id: "m1", title: "One", status: "in-progress" };
		repo.findById.mockResolvedValue(manga);
		const result = await new SaveMangaUseCase(asRepo(repo)).execute({ manga } as any, asLog(makeLog()));
		expect(repo.update).toHaveBeenCalledWith("m1", manga);
		expect(repo.insert).not.toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith("m1");
		expect(result).toEqual(manga);
	});

	it("inserts a new manga with a generated id and no readings", async () => {
		const repo = fakeRepo();
		const saved = { id: "generated", title: "One" };
		repo.findById.mockResolvedValue(saved);
		const result = await new SaveMangaUseCase(asRepo(repo)).execute(
			{
				manga: { title: "One", status: "in-progress" },
			} as any,
			asLog(makeLog()),
		);

		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ title: "One", readings: [] });
		expect(inserted.id).toEqual(expect.any(String));
		expect(repo.findById).toHaveBeenCalledWith(inserted.id);
		expect(result).toBe(saved);
	});

	it("inserts a new manga with an initial reading", async () => {
		const repo = fakeRepo();
		await new SaveMangaUseCase(asRepo(repo)).execute(
			{
				manga: { title: "One", status: "in-progress" },
				reading: { name: "Vol. 1", language: "fr", date: "2024-06-01" },
			} as any,
			asLog(makeLog()),
		);

		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted.readings).toHaveLength(1);
		expect(inserted.readings[0]).toMatchObject({ name: "Vol. 1" });
	});

	it("updates an existing reading when it carries an id", async () => {
		const repo = fakeRepo();
		const reading = { id: "r1", name: "Vol. 1" };
		await new SaveMangaUseCase(asRepo(repo)).execute({ mangaId: "m1", reading } as any, asLog(makeLog()));
		expect(repo.updateReading).toHaveBeenCalledWith("m1", reading);
	});

	it("pushes a freshly built reading when it has no id", async () => {
		const repo = fakeRepo();
		await new SaveMangaUseCase(asRepo(repo)).execute(
			{
				mangaId: "m1",
				reading: { name: "Vol. 1", language: "fr", date: "2024-06-01" },
			} as any,
			asLog(makeLog()),
		);

		const [mangaId, built] = repo.pushReading.mock.calls[0];
		expect(mangaId).toBe("m1");
		expect(built).toMatchObject({ name: "Vol. 1" });
		expect(built.created).toEqual(expect.any(String));
	});

	it("returns a no-op result when there is nothing to do", async () => {
		const repo = fakeRepo();
		await expect(new SaveMangaUseCase(asRepo(repo)).execute({} as any, asLog(makeLog()))).resolves.toEqual({
			error: "Nothing to do",
		});
	});
});

describe("DeleteReadingUseCase", () => {
	it("deletes the reading by manga and reading id", () => {
		const repo = fakeRepo();
		new DeleteReadingUseCase(asRepo(repo)).execute({ mangaId: "m1", readingId: "r1" }, asLog(makeLog()));
		expect(repo.deleteReading).toHaveBeenCalledWith("m1", "r1");
	});

	it("throws when the reading id is missing", () => {
		const repo = fakeRepo();
		expect(() =>
			new DeleteReadingUseCase(asRepo(repo)).execute({ mangaId: "m1", readingId: "" }, asLog(makeLog())),
		).toThrow("Reading ID is required");
	});
});
