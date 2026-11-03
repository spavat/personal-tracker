import { describe, expect, it, vi } from "vitest";

import type { PerformanceRepository } from "./performance.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
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
