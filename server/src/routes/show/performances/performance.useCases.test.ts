import { describe, expect, it, vi } from "vitest";

import type { PerformanceRepository } from "./performance.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	DeletePerformanceUseCase,
	GetPerformanceUseCase,
	ListPerformancesUseCase,
	SaveCastingUseCase,
	SavePerformanceUseCase,
} from "./performance.useCases";

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
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PerformanceRepository;

describe("ListPerformancesUseCase", () => {
	it("forwards the date range to the repository", async () => {
		const repo = fakeRepo();
		await new ListPerformancesUseCase(asRepo(repo)).execute(
			{ from: "2024-01-01", to: "2024-12-31" },
			asLog(makeLog()),
		);
		expect(repo.findAllWithDetails).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
	});

	it("adds the poster url", async () => {
		const repo = fakeRepo();
		repo.findAllWithDetails.mockResolvedValue([
			{ id: 1, posterId: "11111111-1111-4111-8111-111111111111" },
			{ id: 2, posterId: null },
		]);
		const result = await new ListPerformancesUseCase(asRepo(repo)).execute({}, asLog(makeLog()));
		expect(result.map((p) => p.posterUrl)).toEqual(["/images/show/11111111-1111-4111-8111-111111111111", null]);
	});
});

describe("GetPerformanceUseCase", () => {
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

		const result = await new GetPerformanceUseCase(asRepo(repo)).execute(10, asLog(makeLog()));

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
		expect(await new GetPerformanceUseCase(asRepo(fakeRepo())).execute(10, asLog(makeLog()))).toBeNull();
	});
});

describe("SavePerformanceUseCase", () => {
	it("saves the performance directly when place and spectacle ids are already known", async () => {
		const repo = fakeRepo();
		await new SavePerformanceUseCase(asRepo(repo)).execute(
			{
				performance: { id: 3, date: "2024-01-01", canceled: false, seat: "A1", placeId: 7, spectacleId: 100 },
			} as any,
			asLog(makeLog()),
		);

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
			new SavePerformanceUseCase(asRepo(repo)).execute(
				{ performance: { id: 3, date: "2024-01-01", placeId: 7, spectacleId: 100 } } as any,
				asLog(makeLog()),
			),
		).rejects.toThrow("Représentation introuvable");
	});

	it("creates a place when only a place payload is given", async () => {
		const repo = fakeRepo();
		await new SavePerformanceUseCase(asRepo(repo)).execute(
			{
				performance: { date: "2024-01-01", spectacleId: 100 },
				place: { name: "New Hall" },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.insertPlace).toHaveBeenCalledWith(repo.tx, { name: "New Hall" });
		expect(repo.savePerformance).toHaveBeenCalledWith(repo.tx, undefined, expect.objectContaining({ placeId: 70 }));
	});

	it("saves a poster of kind poster from the spectacle", async () => {
		const repo = fakeRepo();
		await new SavePerformanceUseCase(asRepo(repo)).execute(
			{
				performance: {
					id: 3,
					date: "2024-01-01",
					placeId: 7,
					spectacleId: 100,
					posterId: "11111111-1111-4111-8111-111111111111",
				},
			} as any,
			asLog(makeLog()),
		);

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
			new SavePerformanceUseCase(asRepo(repo)).execute(
				{
					performance: {
						id: 3,
						date: "2024-01-01",
						placeId: 7,
						spectacleId: 100,
						posterId: "11111111-1111-4111-8111-111111111111",
					},
				} as any,
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(repo.savePerformance).not.toHaveBeenCalled();
	});

	it("does not check anything without a poster", async () => {
		const repo = fakeRepo();
		await new SavePerformanceUseCase(asRepo(repo)).execute(
			{ performance: { id: 3, date: "2024-01-01", placeId: 7, spectacleId: 100 } } as any,
			asLog(makeLog()),
		);
		expect(repo.findSpectacleMediaKind).not.toHaveBeenCalled();
	});
});

describe("SaveCastingUseCase", () => {
	it("inserts new roles, upserts existing ones and prunes the rest", async () => {
		const repo = fakeRepo();

		await new SaveCastingUseCase(asRepo(repo)).execute(
			{
				performanceId: 10,
				roles: [{ name: "New" }, { id: 2, name: "Existing" }],
			} as any,
			asLog(makeLog()),
		);

		expect(repo.insertRoles).toHaveBeenCalledWith(repo.tx, [{ name: "New", performanceId: 10 }]);
		expect(repo.upsertRoles).toHaveBeenCalledWith(repo.tx, [{ id: 2, name: "Existing", performanceId: 10 }]);
		expect(repo.deleteRolesExcept).toHaveBeenCalledWith(repo.tx, 10, [2], [50]);
	});
});

describe("DeletePerformanceUseCase", () => {
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
		const useCase = new DeletePerformanceUseCase(asRepo(repo), mediaRepo as any, storage as any);
		return { repo, mediaRepo, storage, useCase };
	}

	it("deletes the performance inside a transaction", async () => {
		const { repo, mediaRepo, storage, useCase } = build();
		await useCase.execute(10, asLog(makeLog()));
		expect(repo.findRolePictures).toHaveBeenCalledWith(repo.tx, 10);
		expect(repo.delete).toHaveBeenCalledWith(repo.tx, 10);
		expect(mediaRepo.deleteLink).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("throws a 404 when nothing was deleted, without touching the pictures", async () => {
		const { repo, mediaRepo, storage, useCase } = build([{ artistId: 1, pictureId: "p1" }]);
		repo.delete.mockResolvedValue([]);
		await expect(useCase.execute(10, asLog(makeLog()))).rejects.toMatchObject({ statusCode: 404 });
		expect(mediaRepo.countPictureUses).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("removes a portrait used by no one else, then its file", async () => {
		const { repo, mediaRepo, storage, useCase } = build([{ artistId: 1, pictureId: "p1" }]);
		await useCase.execute(10, asLog(makeLog()));
		expect(mediaRepo.countPictureUses).toHaveBeenCalledWith(repo.tx, 1, "p1");
		expect(mediaRepo.deleteLink).toHaveBeenCalledWith(repo.tx, { artistId: 1 }, "p1");
		expect(mediaRepo.deleteMedia).toHaveBeenCalledWith(repo.tx, "p1");
		expect(storage.deleteObject).toHaveBeenCalledWith(KEY);
	});

	it("keeps a portrait still used by another role or as the artist photo", async () => {
		const { mediaRepo, storage, useCase } = build([{ artistId: 1, pictureId: "p1" }]);
		mediaRepo.countPictureUses.mockResolvedValue(1);
		await useCase.execute(10, asLog(makeLog()));
		expect(mediaRepo.deleteLink).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("keeps the media and its file while another gallery still links it", async () => {
		const { mediaRepo, storage, useCase } = build([{ artistId: 1, pictureId: "p1" }]);
		mediaRepo.countLinks.mockResolvedValue(1);
		await useCase.execute(10, asLog(makeLog()));
		expect(mediaRepo.deleteLink).toHaveBeenCalled();
		expect(mediaRepo.deleteMedia).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("only logs a failed S3 delete", async () => {
		const { storage, useCase } = build([{ artistId: 1, pictureId: "p1" }]);
		storage.deleteObject.mockRejectedValue(new Error("S3 down"));
		const log = makeLog();
		await useCase.execute(10, asLog(log));
		expect(log.warn).toHaveBeenCalled();
	});
});
