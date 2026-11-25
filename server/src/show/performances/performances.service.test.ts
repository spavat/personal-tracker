import { describe, expect, it, vi } from "vitest";

import type { PerformancesRepository } from "./performances.repository.js";

import { BadRequestError, NotFoundError } from "../../common/errors.js";
import { PerformancesService } from "./performances.service.js";

function fakeRepo() {
	const tx = { __tx: true };
	return {
		findAllWithDetails: vi.fn().mockResolvedValue([]),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		insertPlace: vi.fn().mockResolvedValue(NEW_PLACE_ID),
		insertWork: vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000080"),
		insertSpectacle: vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000090"),
		savePerformance: vi.fn().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000011" }]),
		insertRoles: vi.fn().mockResolvedValue([{ id: NEW_ROLE_ID }]),
		upsertRoles: vi.fn().mockResolvedValue(undefined),
		deleteRolesExcept: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue([{ id: PERFORMANCE_ID }]),
		findSpectacleMediaKind: vi.fn().mockResolvedValue("poster"),
		tx,
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PerformancesRepository;
const PERFORMANCE_ID = "00000000-0000-4000-8000-000000000010";
const PLACE_ID = "00000000-0000-4000-8000-000000000007";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000100";
const WORK_ID = "00000000-0000-4000-8000-000000000001";
const MODEL_ID = "00000000-0000-4000-8000-000000000020";
const ROLE_ID = "00000000-0000-4000-8000-000000000002";
const NEW_ROLE_ID = "00000000-0000-4000-8000-000000000050";
const NEW_PLACE_ID = "00000000-0000-4000-8000-000000000070";

describe("PerformancesService.list", () => {
	it("forwards the date range to the repository", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).list({
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
		await new PerformancesService(asRepo(repo)).list({
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
		const result = await new PerformancesService(asRepo(repo)).list({});
		expect(result.map((p) => p.posterUrl)).toEqual(["/images/show/11111111-1111-4111-8111-111111111111", null]);
	});
});

describe("PerformancesService.get", () => {
	it("returns the performance view with the spectacle and its models", async () => {
		const repo = fakeRepo();
		const spectacle = {
			id: SPECTACLE_ID,
			name: "Tosca",
			workId: WORK_ID,
			models: [{ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID, roles: [] }],
		};
		repo.findByIdWithDetails.mockResolvedValue({
			id: PERFORMANCE_ID,
			date: "2024-01-01",
			spectacleId: SPECTACLE_ID,
			spectacle,
			placeName: "Old Bastille",
			place: { id: PLACE_ID, name: "Bastille", country: "fr" },
			posterId: "11111111-1111-4111-8111-111111111111",
			role: [],
		});

		const result = await new PerformancesService(asRepo(repo)).get(PERFORMANCE_ID);

		expect(result).toMatchObject({
			id: PERFORMANCE_ID,
			posterUrl: "/images/show/11111111-1111-4111-8111-111111111111",
			place: { id: PLACE_ID, name: "Old Bastille", country: "fr" },
			roles: [],
		});
		expect(result?.spectacle).toEqual({
			id: SPECTACLE_ID,
			name: "Tosca",
			workId: WORK_ID,
			models: [{ id: MODEL_ID, name: "Cast A", roles: [] }],
		});
	});

	it("returns null for an unknown performance", async () => {
		expect(await new PerformancesService(asRepo(fakeRepo())).get(PERFORMANCE_ID)).toBeNull();
	});
});

describe("PerformancesService.save", () => {
	it("saves the performance directly when place and spectacle ids are already known", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).save(
			{
				performance: {
					date: "2024-01-01",
					canceled: false,
					seat: "A1",
					placeId: PLACE_ID,
					spectacleId: SPECTACLE_ID,
				},
			} as any,
			PERFORMANCE_ID,
		);

		expect(repo.insertPlace).not.toHaveBeenCalled();
		expect(repo.insertSpectacle).not.toHaveBeenCalled();
		expect(repo.savePerformance).toHaveBeenCalledWith(
			repo.tx,
			PERFORMANCE_ID,
			expect.objectContaining({ placeId: PLACE_ID, spectacleId: SPECTACLE_ID, date: "2024-01-01" }),
		);
	});

	it("rejects an unknown performance (rolls back what was created)", async () => {
		const repo = fakeRepo();
		repo.savePerformance.mockResolvedValue([]);
		await expect(
			new PerformancesService(asRepo(repo)).save(
				{
					performance: { date: "2024-01-01", placeId: PLACE_ID, spectacleId: SPECTACLE_ID },
				} as any,
				PERFORMANCE_ID,
			),
		).rejects.toMatchObject({ params: { resource: "performance" } });
	});

	it("creates a place when only a place payload is given", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).save({
			performance: { date: "2024-01-01", spectacleId: SPECTACLE_ID },
			place: { name: "New Hall" },
		} as any);

		expect(repo.insertPlace).toHaveBeenCalledWith(repo.tx, { name: "New Hall" });
		expect(repo.savePerformance).toHaveBeenCalledWith(
			repo.tx,
			undefined,
			expect.objectContaining({ placeId: NEW_PLACE_ID }),
		);
	});

	it("saves a poster of kind poster from the spectacle", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).save(
			{
				performance: {
					date: "2024-01-01",
					placeId: PLACE_ID,
					spectacleId: SPECTACLE_ID,
					posterId: "11111111-1111-4111-8111-111111111111",
				},
			} as any,
			PERFORMANCE_ID,
		);

		expect(repo.findSpectacleMediaKind).toHaveBeenCalledWith(
			repo.tx,
			SPECTACLE_ID,
			"11111111-1111-4111-8111-111111111111",
		);
		expect(repo.savePerformance).toHaveBeenCalledWith(
			repo.tx,
			PERFORMANCE_ID,
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
			new PerformancesService(asRepo(repo)).save(
				{
					performance: {
						date: "2024-01-01",
						placeId: PLACE_ID,
						spectacleId: SPECTACLE_ID,
						posterId: "11111111-1111-4111-8111-111111111111",
					},
				} as any,
				PERFORMANCE_ID,
			),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(repo.savePerformance).not.toHaveBeenCalled();
	});

	it("does not check anything without a poster", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).save(
			{
				performance: { date: "2024-01-01", placeId: PLACE_ID, spectacleId: SPECTACLE_ID },
			} as any,
			PERFORMANCE_ID,
		);
		expect(repo.findSpectacleMediaKind).not.toHaveBeenCalled();
	});
});

describe("PerformancesService.saveCasting", () => {
	it("inserts new roles, upserts existing ones and prunes the rest", async () => {
		const repo = fakeRepo();

		await new PerformancesService(asRepo(repo)).saveCasting(PERFORMANCE_ID, {
			roles: [{ name: "New" }, { id: ROLE_ID, name: "Existing" }],
		} as any);

		expect(repo.insertRoles).toHaveBeenCalledWith(repo.tx, [{ name: "New", performanceId: PERFORMANCE_ID }]);
		expect(repo.upsertRoles).toHaveBeenCalledWith(repo.tx, [
			{ id: ROLE_ID, name: "Existing", performanceId: PERFORMANCE_ID },
		]);
		expect(repo.deleteRolesExcept).toHaveBeenCalledWith(repo.tx, PERFORMANCE_ID, [ROLE_ID], [NEW_ROLE_ID]);
	});
});

describe("PerformancesService.delete", () => {
	it("deletes the performance inside a transaction", async () => {
		const repo = fakeRepo();
		await new PerformancesService(asRepo(repo)).delete(PERFORMANCE_ID);
		expect(repo.delete).toHaveBeenCalledWith(repo.tx, PERFORMANCE_ID);
	});

	it("throws a 404 when nothing was deleted", async () => {
		const repo = fakeRepo();
		repo.delete.mockResolvedValue([]);
		await expect(new PerformancesService(asRepo(repo)).delete(PERFORMANCE_ID)).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});
});
