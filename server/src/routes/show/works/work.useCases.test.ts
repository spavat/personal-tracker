import { describe, expect, it, vi } from "vitest";

import type { WorkRepository } from "./work.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	DeleteWorkUseCase,
	GetGroupedWorksUseCase,
	GetWorkUseCase,
	ListWorksUseCase,
	SaveWorkUseCase,
} from "./work.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findAllWithSpectaclesPerformancesAndPlaces: vi.fn().mockResolvedValue(null),
		findByIdWithSpectacles: vi.fn().mockResolvedValue(null),
		save: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as WorkRepository;

describe("work use cases", () => {
	it("list returns the repository list", async () => {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue([{ id: 1 }]);
		expect(await new ListWorksUseCase(asRepo(repo)).execute(asLog(makeLog()))).toEqual([{ id: 1 }]);
	});

	it("grouped returns an empty object when there is nothing to group", async () => {
		expect(await new GetGroupedWorksUseCase(asRepo(fakeRepo())).execute(false, asLog(makeLog()))).toEqual({});
	});

	it("grouped counts a work and a spectacle whose first performance of the year is canceled", async () => {
		const repo = fakeRepo();
		const place = { id: 7, name: "Bastille", country: "fr" };
		repo.findAllWithSpectaclesPerformancesAndPlaces.mockResolvedValue([
			{
				id: 1,
				name: "Tosca",
				spectacle: [
					{
						id: 1,
						name: "Tosca (Bastille)",
						performance: [
							{ id: 10, date: "2024-02-01", canceled: true, placeId: 7, placeName: "Bastille", place },
							{ id: 11, date: "2024-04-01", canceled: false, placeId: 7, placeName: "Bastille", place },
						],
					},
				],
			},
			{
				id: 2,
				name: "Carmen",
				spectacle: [
					{
						id: 2,
						name: "Carmen",
						performance: [
							{ id: 12, date: "2024-05-01", canceled: true, placeId: 7, placeName: "Bastille", place },
						],
					},
				],
			},
		]);

		const result = await new GetGroupedWorksUseCase(asRepo(repo)).execute(true, asLog(makeLog()));

		expect(result).toMatchObject([{ name: "2024", nbWorks: 1, nbSpectacles: 1, nbPerformances: 1 }]);
	});

	it("get delegates to findByIdWithSpectacles", () => {
		const repo = fakeRepo();
		new GetWorkUseCase(asRepo(repo)).execute(4, asLog(makeLog()));
		expect(repo.findByIdWithSpectacles).toHaveBeenCalledWith(4);
	});

	it("save and delete persist then report ok", async () => {
		const repo = fakeRepo();
		expect(await new SaveWorkUseCase(asRepo(repo)).execute({ name: "Tosca" } as any, asLog(makeLog()))).toEqual({
			ok: true,
		});
		expect(repo.save).toHaveBeenCalledWith({ name: "Tosca" });
		expect(await new DeleteWorkUseCase(asRepo(repo)).execute(4, asLog(makeLog()))).toEqual({ ok: true });
		expect(repo.delete).toHaveBeenCalledWith(4);
	});
});
