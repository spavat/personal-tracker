import { describe, expect, it, vi } from "vitest";

import type { PlacesRepository } from "./places.repository.js";

import { PlacesService } from "./places.service.js";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findByIdWithPerformances: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
		save: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(true),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PlacesRepository;
const PLACE_ID = "00000000-0000-4000-8000-000000000007";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000101";

describe("PlacesService.list / Save / Delete", () => {
	it("defaults the sort and forwards save/delete", async () => {
		const repo = fakeRepo();
		await new PlacesService(asRepo(repo)).list(undefined);
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "name", sortDirection: "asc" });

		repo.save.mockResolvedValue({ id: PLACE_ID, name: "Bastille", formerNames: [] });
		expect(await new PlacesService(asRepo(repo)).save({ name: "Bastille" } as any)).toEqual({
			id: PLACE_ID,
			name: "Bastille",
			formerNames: [],
		});
		expect(repo.save).toHaveBeenCalledWith({ name: "Bastille" });

		await new PlacesService(asRepo(repo)).delete(PLACE_ID);
		expect(repo.delete).toHaveBeenCalledWith(PLACE_ID);
	});
});

describe("PlacesService.get", () => {
	it("counts non-canceled performances and unique spectacles", async () => {
		const repo = fakeRepo();
		repo.findByIdWithPerformances.mockResolvedValue({
			id: PLACE_ID,
			name: "Bastille",
			address: "Place de la Bastille",
			country: "fr",
			formerNames: [{ id: 1, placeId: PLACE_ID, name: "Old Bastille", untilDate: "2024-02-01" }],
			performance: [
				{
					id: 1,
					date: "2024-01-01",
					canceled: false,
					spectacleId: 100,
					spectacle: { id: 100, name: "Tosca" },
					placeName: "Old Bastille",
					place: { id: PLACE_ID, name: "Bastille", country: "fr" },
				},
				{
					id: 2,
					date: "2024-02-01",
					canceled: true,
					spectacleId: SPECTACLE_ID,
					spectacle: { id: SPECTACLE_ID, name: "Norma" },
					place: { id: PLACE_ID, name: "Bastille", country: "fr" },
				},
				{
					id: 3,
					date: "2024-03-01",
					canceled: false,
					spectacleId: 100,
					spectacle: { id: 100, name: "Tosca" },
					place: { id: PLACE_ID, name: "Bastille", country: "fr" },
				},
			],
		});

		const result = await new PlacesService(asRepo(repo)).get({ placeId: PLACE_ID, groupBySpectacle: false });

		expect(result).toMatchObject({
			id: PLACE_ID,
			name: "Bastille",
			country: "fr",
			formerNames: [{ name: "Old Bastille", untilDate: "2024-02-01" }],
			stats: { nbPerformances: 2, nbSpectacles: 1, lastPerformance: "2024-03-01" },
		});
		expect(result?.groups[0].performances.map((p: any) => p.id)).toEqual([1, 2, 3]);
		expect(result?.groups[0].performances[0].place?.name).toBe("Old Bastille");
	});
});
