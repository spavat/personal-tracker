import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { MediaStorageRepository } from "../media/media-storage.repository.js";
import type { MediaRepository } from "../media/media.repository.js";
import type { PerformancesRepository } from "./performances.repository.js";

import { BadRequestError, NotFoundError } from "../../common/errors.js";
import { PerformancesService } from "./performances.service.js";

function fakeRepo() {
	const tx = { __tx: true };
	return {
		findAllWithDetails: vi.fn().mockResolvedValue([]),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		insertPlace: vi.fn().mockResolvedValue([{ id: 70 }]),
		insertWork: vi.fn().mockResolvedValue([{ id: 80 }]),
		insertSpectacle: vi.fn().mockResolvedValue([{ id: 90 }]),
		savePerformance: vi.fn().mockResolvedValue([{ id: 11 }]),
		insertRoles: vi.fn().mockResolvedValue([{ id: 50 }]),
		upsertRoles: vi.fn().mockResolvedValue(undefined),
		deleteRolesExcept: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue([{ id: 10 }]),
		findSpectacleMediaKind: vi.fn().mockResolvedValue("poster"),
		tx,
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PerformancesRepository;

describe("PerformancesService.list", () => {
	it("forwards the date range to the repository", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).list({
			from: "2024-01-01",
			to: "2024-12-31",
		});
		expect(repo.findAllWithDetails).toHaveBeenCalledWith({
			from: "2024-01-01",
			to: "2024-12-31",
			sortDirection: "asc",
		});
	});

	it("forwards the sort direction", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).list({
			sort: ["date", "desc"],
		});
		expect(repo.findAllWithDetails).toHaveBeenCalledWith({ sortDirection: "desc" });
	});

	it("adds the poster url", async () => {
		const repo = fakeRepo();
		repo.findAllWithDetails.mockResolvedValue([
			{ id: 1, posterId: "11111111-1111-4111-8111-111111111111" },
			{ id: 2, posterId: null },
		]);
		const result = await new PerformancesService(
			asRepo(repo),
			{} as MediaRepository,
			{} as MediaStorageRepository,
		).list({});
		expect(result.map((p) => p.posterUrl)).toEqual(["/images/show/11111111-1111-4111-8111-111111111111", null]);
	});
});

describe("PerformancesService.get", () => {
	it("returns the performance view with the spectacle and its models", async () => {
		const repo = fakeRepo();
		const spectacle = {
			id: 100,
			name: "Tosca",
			workId: 1,
			models: [{ id: 20, name: "Cast A", spectacleId: 100, roles: [] }],
		};
		repo.findByIdWithDetails.mockResolvedValue({
			id: 10,
			date: "2024-01-01",
			spectacleId: 100,
			spectacle,
			placeName: "Old Bastille",
			place: { id: 7, name: "Bastille", country: "fr" },
			posterId: "11111111-1111-4111-8111-111111111111",
			role: [],
		});

		const result = await new PerformancesService(
			asRepo(repo),
			{} as MediaRepository,
			{} as MediaStorageRepository,
		).get(10);

		expect(result).toMatchObject({
			id: 10,
			posterUrl: "/images/show/11111111-1111-4111-8111-111111111111",
			place: { id: 7, name: "Old Bastille", country: "fr" },
			roles: [],
		});
		expect(result?.spectacle).toEqual({
			id: 100,
			name: "Tosca",
			workId: 1,
			models: [{ id: 20, name: "Cast A", roles: [] }],
		});
	});

	it("returns null for an unknown performance", async () => {
		expect(
			await new PerformancesService(asRepo(fakeRepo()), {} as MediaRepository, {} as MediaStorageRepository).get(
				10,
			),
		).toBeNull();
	});
});

describe("PerformancesService.save", () => {
	it("saves the performance directly when place and spectacle ids are already known", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
			performance: { id: 3, date: "2024-01-01", canceled: false, seat: "A1", placeId: 7, spectacleId: 100 },
		} as any);

		expect(repo.insertPlace).not.toHaveBeenCalled();
		expect(repo.insertSpectacle).not.toHaveBeenCalled();
		expect(repo.savePerformance).toHaveBeenCalledWith(
			repo.tx,
			3,
			expect.objectContaining({ placeId: 7, spectacleId: 100, date: "2024-01-01" }),
		);
	});

	it("rejects an unknown performance (rolls back what was created)", async () => {
		const repo = fakeRepo();
		repo.savePerformance.mockResolvedValue([]);
		await expect(
			new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
				performance: { id: 3, date: "2024-01-01", placeId: 7, spectacleId: 100 },
			} as any),
		).rejects.toThrow("Représentation introuvable");
	});

	it("creates a place when only a place payload is given", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
			performance: { date: "2024-01-01", spectacleId: 100 },
			place: { name: "New Hall" },
		} as any);

		expect(repo.insertPlace).toHaveBeenCalledWith(repo.tx, { name: "New Hall" });
		expect(repo.savePerformance).toHaveBeenCalledWith(repo.tx, undefined, expect.objectContaining({ placeId: 70 }));
	});

	it("saves a poster of kind poster from the spectacle", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
			performance: {
				id: 3,
				date: "2024-01-01",
				placeId: 7,
				spectacleId: 100,
				posterId: "11111111-1111-4111-8111-111111111111",
			},
		} as any);

		expect(repo.findSpectacleMediaKind).toHaveBeenCalledWith(repo.tx, 100, "11111111-1111-4111-8111-111111111111");
		expect(repo.savePerformance).toHaveBeenCalledWith(
			repo.tx,
			3,
			expect.objectContaining({ posterId: "11111111-1111-4111-8111-111111111111" }),
		);
	});

	it.each([
		["another kind", "programme"],
		["another spectacle", undefined],
	])("rejects a poster of %s with a 400", async (_, kind) => {
		const repo = fakeRepo();
		repo.findSpectacleMediaKind.mockResolvedValue(kind);
		await expect(
			new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
				performance: {
					id: 3,
					date: "2024-01-01",
					placeId: 7,
					spectacleId: 100,
					posterId: "11111111-1111-4111-8111-111111111111",
				},
			} as any),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(repo.savePerformance).not.toHaveBeenCalled();
	});

	it("does not check anything without a poster", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).save({
			performance: { id: 3, date: "2024-01-01", placeId: 7, spectacleId: 100 },
		} as any);
		expect(repo.findSpectacleMediaKind).not.toHaveBeenCalled();
	});
});

describe("PerformancesService.saveCasting", () => {
	it("inserts new roles, upserts existing ones and prunes the rest", async () => {
		const repo = fakeRepo();

		await new PerformancesService(asRepo(repo), {} as MediaRepository, {} as MediaStorageRepository).saveCasting({
			performanceId: 10,
			roles: [{ name: "New" }, { id: 2, name: "Existing" }],
		} as any);

		expect(repo.insertRoles).toHaveBeenCalledWith(repo.tx, [{ name: "New", performanceId: 10 }]);
		expect(repo.upsertRoles).toHaveBeenCalledWith(repo.tx, [{ id: 2, name: "Existing", performanceId: 10 }]);
		expect(repo.deleteRolesExcept).toHaveBeenCalledWith(repo.tx, 10, [2], [50]);
	});
});

describe("PerformancesService.delete", () => {
	const KEY = "personal-tracker/show/media/p1.avif";

	function fakeMediaRepo() {
		return {
			countPictureUses: vi.fn().mockResolvedValue(0),
			deleteLink: vi.fn().mockResolvedValue([{ mediaId: "p1" }]),
			countLinks: vi.fn().mockResolvedValue(0),
			deleteMedia: vi.fn().mockResolvedValue([{ key: KEY }]),
		};
	}
	function fakeStorage() {
		return { deleteObject: vi.fn().mockResolvedValue(undefined) };
	}
	function build(pictures: { artistId: number; pictureId: string }[] = []) {
		const repo = { ...fakeRepo(), findRolePictures: vi.fn().mockResolvedValue(pictures) };
		const mediaRepo = fakeMediaRepo();
		const storage = fakeStorage();
		const service = new PerformancesService(asRepo(repo), mediaRepo as any, storage as any);
		return { repo, mediaRepo, storage, service };
	}

	it("deletes the performance inside a transaction", async () => {
		const { repo, mediaRepo, storage, service } = build();
		await service.delete(10);
		expect(repo.findRolePictures).toHaveBeenCalledWith(repo.tx, 10);
		expect(repo.delete).toHaveBeenCalledWith(repo.tx, 10);
		expect(mediaRepo.deleteLink).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("throws a 404 when nothing was deleted, without touching the pictures", async () => {
		const { repo, mediaRepo, storage, service } = build([{ artistId: 1, pictureId: "p1" }]);
		repo.delete.mockResolvedValue([]);
		await expect(service.delete(10)).rejects.toBeInstanceOf(NotFoundError);
		expect(mediaRepo.countPictureUses).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("removes a portrait used by no one else, then its file", async () => {
		const { repo, mediaRepo, storage, service } = build([{ artistId: 1, pictureId: "p1" }]);
		await service.delete(10);
		expect(mediaRepo.countPictureUses).toHaveBeenCalledWith(repo.tx, 1, "p1");
		expect(mediaRepo.deleteLink).toHaveBeenCalledWith(repo.tx, { artistId: 1 }, "p1");
		expect(mediaRepo.deleteMedia).toHaveBeenCalledWith(repo.tx, "p1");
		expect(storage.deleteObject).toHaveBeenCalledWith(KEY);
	});

	it("keeps a portrait still used by another role or as the artist photo", async () => {
		const { mediaRepo, storage, service } = build([{ artistId: 1, pictureId: "p1" }]);
		mediaRepo.countPictureUses.mockResolvedValue(1);
		await service.delete(10);
		expect(mediaRepo.deleteLink).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("keeps the media and its file while another gallery still links it", async () => {
		const { mediaRepo, storage, service } = build([{ artistId: 1, pictureId: "p1" }]);
		mediaRepo.countLinks.mockResolvedValue(1);
		await service.delete(10);
		expect(mediaRepo.deleteLink).toHaveBeenCalled();
		expect(mediaRepo.deleteMedia).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("only logs a failed S3 delete", async () => {
		const { storage, service } = build([{ artistId: 1, pictureId: "p1" }]);
		storage.deleteObject.mockRejectedValue(new Error("S3 down"));
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		await service.delete(10);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
