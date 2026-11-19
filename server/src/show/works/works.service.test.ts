import { describe, expect, it, vi } from "vitest";

import type { WorksRepository } from "./works.repository.js";

import { WorksService } from "./works.service.js";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findAllWithSpectaclesPerformancesAndPlaces: vi.fn().mockResolvedValue(null),
		findByIdWithSpectacles: vi.fn().mockResolvedValue(null),
		save: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as WorksRepository;

describe("WorksService", () => {
	it("list returns the repository list", async () => {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue([{ id: 1 }]);
		expect(await new WorksService(asRepo(repo)).list()).toEqual([{ id: 1 }]);
	});

	it("grouped returns an empty object when there is nothing to group", async () => {
		expect(await new WorksService(asRepo(fakeRepo())).listGrouped(false)).toEqual({});
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

		const result = await new WorksService(asRepo(repo)).listGrouped(true);

		expect(result).toMatchObject([{ name: "2024", nbWorks: 1, nbSpectacles: 1, nbPerformances: 1 }]);
	});

	it("get delegates to findByIdWithSpectacles", () => {
		const repo = fakeRepo();
		new WorksService(asRepo(repo)).get(4);
		expect(repo.findByIdWithSpectacles).toHaveBeenCalledWith(4);
	});

	it("save returns the saved work, delete persists", async () => {
		const repo = fakeRepo();
		repo.save.mockResolvedValue({ id: 4, name: "Tosca" });
		expect(await new WorksService(asRepo(repo)).save({ name: "Tosca" } as any)).toEqual({
			id: 4,
			name: "Tosca",
		});
		expect(repo.save).toHaveBeenCalledWith({ name: "Tosca" });
		await new WorksService(asRepo(repo)).delete(4);
		expect(repo.delete).toHaveBeenCalledWith(4);
	});
});
