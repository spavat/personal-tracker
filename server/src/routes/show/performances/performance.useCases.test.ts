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
		findAll: vi.fn().mockResolvedValue([]),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		insertPlace: vi.fn().mockResolvedValue([{ id: 70 }]),
		insertWork: vi.fn().mockResolvedValue([{ id: 80 }]),
		insertSpectacle: vi.fn().mockResolvedValue([{ id: 90 }]),
		savePerformance: vi.fn().mockResolvedValue(undefined),
		insertRoles: vi.fn().mockResolvedValue([{ id: 50 }]),
		upsertRoles: vi.fn().mockResolvedValue(undefined),
		deleteRolesExcept: vi.fn().mockResolvedValue(undefined),
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
		expect(repo.findAll).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
	});
});

describe("GetPerformanceUseCase", () => {
	it("splits role details out into a flat roles array", async () => {
		const repo = fakeRepo();
		repo.findByIdWithDetails.mockResolvedValue({
			id: 10,
			date: "2024-01-01",
			role: [{ id: 1, artistId: 5, artist: { name: "Callas" }, name: "Tosca", status: "confirmed", main: true }],
		});

		const result = await new GetPerformanceUseCase(asRepo(repo)).execute(10, asLog(makeLog()));

		expect(result).toEqual({
			id: 10,
			date: "2024-01-01",
			roles: [{ id: 1, artistId: 5, artistName: "Callas", name: "Tosca", status: "confirmed", main: true }],
		});
	});

	it("names the place as it was at the performance date", async () => {
		const repo = fakeRepo();
		repo.findByIdWithDetails.mockResolvedValue({
			id: 10,
			date: "2024-01-01",
			placeName: "Old Bastille",
			place: { id: 7, name: "Bastille", country: "fr" },
			role: [],
		});

		const result = await new GetPerformanceUseCase(asRepo(repo)).execute(10, asLog(makeLog()));

		expect(result).toEqual({
			id: 10,
			date: "2024-01-01",
			place: { id: 7, name: "Old Bastille", country: "fr" },
			roles: [],
		});
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
