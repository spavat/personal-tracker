import { describe, expect, it, vi } from "vitest";

import type { SpectacleRepository } from "./spectacle.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { GetGroupedSpectaclesUseCase, GetSpectacleUseCase, ListSpectaclesUseCase } from "./spectacle.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findAllWithPerformancesAndPlaces: vi.fn().mockResolvedValue(null),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as SpectacleRepository;

describe("ListSpectaclesUseCase", () => {
	it("returns the repository list", async () => {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue([{ id: 1 }]);
		expect(await new ListSpectaclesUseCase(asRepo(repo)).execute(asLog(makeLog()))).toEqual([{ id: 1 }]);
	});
});

describe("GetGroupedSpectaclesUseCase", () => {
	it("returns an empty object when there is nothing to group", async () => {
		expect(await new GetGroupedSpectaclesUseCase(asRepo(fakeRepo())).execute(false, asLog(makeLog()))).toEqual({});
	});

	it("counts a spectacle whose first performance of the year is canceled", async () => {
		const repo = fakeRepo();
		const place = { id: 7, name: "Bastille", country: "fr" };
		repo.findAllWithPerformancesAndPlaces.mockResolvedValue([
			{
				id: 1,
				name: "Tosca",
				performance: [
					{ id: 10, date: "2024-02-01", canceled: true, placeId: 7, placeName: "Bastille", place },
					{ id: 11, date: "2024-04-01", canceled: false, placeId: 7, placeName: "Bastille", place },
				],
			},
			{
				id: 2,
				name: "Carmen",
				performance: [{ id: 12, date: "2024-05-01", canceled: true, placeId: 7, placeName: "Bastille", place }],
			},
		]);

		const result = await new GetGroupedSpectaclesUseCase(asRepo(repo)).execute(true, asLog(makeLog()));

		expect(result).toMatchObject([{ name: "2024", nbSpectacles: 1, nbPerformances: 1 }]);
	});
});

describe("GetSpectacleUseCase", () => {
	it("returns null for an unknown spectacle", async () => {
		expect(await new GetSpectacleUseCase(asRepo(fakeRepo())).execute(1, asLog(makeLog()))).toBeNull();
	});

	it("maps performances, cast and models into the response shape", async () => {
		const repo = fakeRepo();
		repo.findByIdWithDetails.mockResolvedValue({
			id: 1,
			name: "Tosca",
			performance: [
				{
					id: 10,
					date: "2024-01-01",
					canceled: false,
					seat: "A1",
					casting_status: "ok",
					casting_origin: "manual",
					placeName: "Old Bastille",
					place: { id: 7, name: "Bastille", country: "fr" },
					role: [{ id: 3, artistId: 5, artist: { name: "Callas" }, name: "Tosca", status: "confirmed" }],
				},
			],
			models: [
				{
					id: 20,
					name: "Cast A",
					roles: [{ id: 4, name: "Lead", main: true, artistId: 5, artist: { name: "Callas" } }],
				},
			],
		});

		const result = await new GetSpectacleUseCase(asRepo(repo)).execute(1, asLog(makeLog()));

		expect(result).toEqual({
			id: 1,
			name: "Tosca",
			performances: [
				{
					id: 10,
					date: "2024-01-01",
					canceled: false,
					seat: "A1",
					place: { id: 7, name: "Old Bastille", country: "fr" },
					cast: [{ id: 3, artist_id: 5, artist_name: "Callas", name: "Tosca", status: "confirmed" }],
					casting_status: "ok",
					casting_origin: "manual",
				},
			],
			models: [
				{
					id: 20,
					name: "Cast A",
					roles: [{ id: 4, name: "Lead", main: true, artistId: 5, artistName: "Callas" }],
				},
			],
		});
	});
});
