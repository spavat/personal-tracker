import { describe, expect, it, vi } from "vitest";

import type { PlaceRepository } from "./place.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { DeletePlaceUseCase, GetPlaceUseCase, ListPlacesUseCase, SavePlaceUseCase } from "./place.useCases";

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

describe("ListPlacesUseCase / Save / Delete", () => {
	it("defaults the sort and forwards save/delete", async () => {
		const repo = fakeRepo();
		await new ListPlacesUseCase(asRepo(repo)).execute(undefined, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "name", sortDirection: "asc" });

		expect(await new SavePlaceUseCase(asRepo(repo)).execute({ name: "Bastille" } as any, asLog(makeLog()))).toEqual(
			{ ok: true },
		);
		expect(repo.save).toHaveBeenCalledWith({ name: "Bastille" });

		expect(await new DeletePlaceUseCase(asRepo(repo)).execute(3, asLog(makeLog()))).toEqual({ ok: true });
		expect(repo.delete).toHaveBeenCalledWith(3);
	});
});

describe("GetPlaceUseCase", () => {
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

		const result = await new GetPlaceUseCase(asRepo(repo)).execute(
			{ placeId: 7, groupBySpectacle: false },
			asLog(makeLog()),
		);

		expect(result).toMatchObject({
			id: 7,
			name: "Bastille",
			country: "fr",
			formerNames: [{ name: "Old Bastille", untilDate: "2024-02-01" }],
			stats: { nbPerformances: 2, nbSpectacles: 1, lastPerformance: "2024-03-01" },
		});
		expect(result?.groups[0].performances.map((p: any) => p.id)).toEqual([1, 2, 3]);
		expect(result?.groups[0].performances[0].placeName).toBe("Old Bastille");
	});
});
