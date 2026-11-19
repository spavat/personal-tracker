import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../common/errors.js";
import { ReadingMangaRepository } from "./reading-manga.repository.js";
import { ReadingMangaService } from "./reading-manga.service.js";

describe("ReadingMangaService", () => {
	let service: ReadingMangaService;
	const repo = {
		findAll: vi.fn(),
		findById: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		updateReading: vi.fn(),
		pushReading: vi.fn(),
		deleteReading: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [ReadingMangaService, { provide: ReadingMangaRepository, useValue: repo }],
		}).compile();
		service = ref.get(ReadingMangaService);
	});

	describe("list", () => {
		it("defaults sort to title asc and forwards the filters", () => {
			service.list({ search: "one", from: "2024-01-01", to: "2024-12-31", withReadings: true } as never);

			expect(repo.findAll).toHaveBeenCalledWith({
				search: "one",
				from: "2024-01-01",
				to: "2024-12-31",
				withReadings: true,
				sortField: "title",
				sortDirection: "asc",
			});
		});

		it("passes an explicit sort tuple through", () => {
			service.list({ sort: ["lastReadingDate", "desc"], withReadings: false } as never);

			expect(repo.findAll.mock.calls[0][0]).toMatchObject({
				sortField: "lastReadingDate",
				sortDirection: "desc",
			});
		});
	});

	describe("get", () => {
		it("returns the manga found by id", async () => {
			const manga = { id: "m1", title: "One" };
			repo.findById.mockResolvedValue(manga);

			await expect(service.get("m1")).resolves.toBe(manga);
			expect(repo.findById).toHaveBeenCalledWith("m1");
		});

		it("rejects with NotFoundError for an unknown manga", async () => {
			repo.findById.mockResolvedValue(null);

			await expect(service.get("m1")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("save", () => {
		it("updates an existing manga", async () => {
			const manga = { id: "m1", title: "One", status: "in-progress" };
			repo.findById.mockResolvedValue(manga);

			const result = await service.save({ manga } as never);

			expect(repo.update).toHaveBeenCalledWith("m1", manga);
			expect(repo.insert).not.toHaveBeenCalled();
			expect(repo.findById).toHaveBeenCalledWith("m1");
			expect(result).toEqual(manga);
		});

		it("inserts a new manga with a generated id and no readings", async () => {
			const saved = { id: "generated", title: "One" };
			repo.findById.mockResolvedValue(saved);

			const result = await service.save({ manga: { title: "One", status: "in-progress" } } as never);

			const inserted = repo.insert.mock.calls[0][0];
			expect(inserted).toMatchObject({ title: "One", readings: [] });
			expect(inserted.id).toEqual(expect.any(String));
			expect(repo.findById).toHaveBeenCalledWith(inserted.id);
			expect(result).toBe(saved);
		});

		it("inserts a new manga with an initial reading", async () => {
			await service.save({
				manga: { title: "One", status: "in-progress" },
				reading: { name: "Vol. 1", language: "fr", date: "2024-06-01" },
			} as never);

			const inserted = repo.insert.mock.calls[0][0];
			expect(inserted.readings).toHaveLength(1);
			expect(inserted.readings[0]).toMatchObject({ name: "Vol. 1" });
		});

		it("updates an existing reading when it carries an id", async () => {
			const reading = { id: "r1", name: "Vol. 1" };

			await service.save({ mangaId: "m1", reading } as never);

			expect(repo.updateReading).toHaveBeenCalledWith("m1", reading);
		});

		it("pushes a freshly built reading when it has no id", async () => {
			await service.save({
				mangaId: "m1",
				reading: { name: "Vol. 1", language: "fr", date: "2024-06-01" },
			} as never);

			const [mangaId, built] = repo.pushReading.mock.calls[0];
			expect(mangaId).toBe("m1");
			expect(built).toMatchObject({ name: "Vol. 1" });
			expect(built.created).toEqual(expect.any(String));
		});
	});

	describe("deleteReading", () => {
		it("deletes the reading by manga and reading id", () => {
			service.deleteReading("m1", "r1");

			expect(repo.deleteReading).toHaveBeenCalledWith("m1", "r1");
		});
	});
});
