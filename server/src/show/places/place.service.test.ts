import { describe, expect, it, vi } from "vitest";

import type { PlaceRepository } from "./place.repository.js";

import { PlaceService } from "./place.service.js";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findByIdWithPerformances: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
		save: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PlaceRepository;

describe("PlaceService.list / Save / Delete", () => {
	it("defaults the sort and forwards save/delete", async () => {
		const repo = fakeRepo();
		await new PlaceService(asRepo(repo)).list(undefined);
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "name", sortDirection: "asc" });

		repo.save.mockResolvedValue({ id: 3, name: "Bastille", formerNames: [] });
		expect(await new PlaceService(asRepo(repo)).save({ name: "Bastille" } as any)).toEqual({
			id: 3,
			name: "Bastille",
			formerNames: [],
		});
		expect(repo.save).toHaveBeenCalledWith({ name: "Bastille" });

		await new PlaceService(asRepo(repo)).delete(3);
		expect(repo.delete).toHaveBeenCalledWith(3);
	});
});

describe("PlaceService.get", () => {
	it("counts non-canceled performances and unique spectacles", async () => {
		const repo = fakeRepo();
		repo.findByIdWithPerformances.mockResolvedValue({
			id: 7,
			name: "Bastille",
			address: "Place de la Bastille",
			country: "fr",
			formerNames: [{ id: 1, placeId: 7, name: "Old Bastille", untilDate: "2024-02-01" }],
			performance: [
				{
					id: 1,
					date: "2024-01-01",
					canceled: false,
					spectacleId: 100,
					spectacle: { id: 100, name: "Tosca" },
					placeName: "Old Bastille",
					place: { id: 7, name: "Bastille", country: "fr" },
				},
				{
					id: 2,
					date: "2024-02-01",
					canceled: true,
					spectacleId: 101,
					spectacle: { id: 101, name: "Norma" },
					place: { id: 7, name: "Bastille", country: "fr" },
				},
				{
					id: 3,
					date: "2024-03-01",
					canceled: false,
					spectacleId: 100,
					spectacle: { id: 100, name: "Tosca" },
					place: { id: 7, name: "Bastille", country: "fr" },
				},
			],
		});

		const result = await new PlaceService(asRepo(repo)).get({ placeId: 7, groupBySpectacle: false });

		expect(result).toMatchObject({
			id: 7,
			name: "Bastille",
			country: "fr",
			formerNames: [{ name: "Old Bastille", untilDate: "2024-02-01" }],
			stats: { nbPerformances: 2, nbSpectacles: 1, lastPerformance: "2024-03-01" },
		});
		expect(result?.groups[0].performances.map((p: any) => p.id)).toEqual([1, 2, 3]);
		expect(result?.groups[0].performances[0].place?.name).toBe("Old Bastille");
	});
});
