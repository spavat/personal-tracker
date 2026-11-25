import { describe, expect, it, vi } from "vitest";

import type { SpectaclesRepository } from "./spectacles.repository.js";

import { SpectaclesService } from "./spectacles.service.js";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findAllWithPerformancesAndPlaces: vi.fn().mockResolvedValue(null),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
		save: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as SpectaclesRepository;
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000001";
const WORK_ID = "00000000-0000-4000-8000-000000000002";
const ENTITY_ID = "00000000-0000-4000-8000-000000000005";

describe("SpectaclesService.list", () => {
	it("returns the repository list", async () => {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue([{ id: SPECTACLE_ID }]);
		expect(await new SpectaclesService(asRepo(repo)).list()).toEqual([{ id: SPECTACLE_ID }]);
	});
});

describe("SpectaclesService.listGrouped", () => {
	it("returns an empty object when there is nothing to group", async () => {
		expect(await new SpectaclesService(asRepo(fakeRepo())).listGrouped(false)).toEqual({});
	});

	it("counts a spectacle whose first performance of the year is canceled", async () => {
		const repo = fakeRepo();
		const place = { id: 7, name: "Bastille", country: "fr" };
		repo.findAllWithPerformancesAndPlaces.mockResolvedValue([
			{
				id: SPECTACLE_ID,
				name: "Tosca",
				performance: [
					{ id: 10, date: "2024-02-01", canceled: true, placeId: 7, placeName: "Bastille", place },
					{ id: 11, date: "2024-04-01", canceled: false, placeId: 7, placeName: "Bastille", place },
				],
			},
			{
				id: "00000000-0000-4000-8000-0000000000c2",
				name: "Carmen",
				performance: [
					{
						id: "22222222-2222-4222-8222-222222222222",
						date: "2024-05-01",
						canceled: true,
						placeId: 7,
						placeName: "Bastille",
						place,
					},
				],
			},
		]);

		const result = await new SpectaclesService(asRepo(repo)).listGrouped(true);

		expect(result).toMatchObject([{ name: "2024", nbSpectacles: 1, nbPerformances: 1 }]);
	});
});

describe("SpectaclesService.get", () => {
	it("returns null for an unknown spectacle", async () => {
		expect(await new SpectaclesService(asRepo(fakeRepo())).get(SPECTACLE_ID)).toBeNull();
	});

	it("maps performances, cast and models into the response shape", async () => {
		const repo = fakeRepo();
		repo.findByIdWithDetails.mockResolvedValue({
			id: SPECTACLE_ID,
			name: "Tosca",
			workId: WORK_ID,
			description: "Drame lyrique",
			descriptionSource: "https://fr.wikipedia.org/wiki/Tosca",
			links: [{ label: "Wikipédia", url: "https://fr.wikipedia.org/wiki/Tosca" }],
			tracklist: "# Acte 1\n- Recondita armonia",
			performance: [
				{
					id: 10,
					date: "2024-01-01",
					canceled: false,
					seat: "A1",
					casting_status: "ok",
					casting_origin: "manual",
					spectacleId: SPECTACLE_ID,
					placeName: "Old Bastille",
					place: { id: 7, name: "Bastille", country: "fr" },
					posterId: "11111111-1111-4111-8111-111111111111",
					role: [
						{
							id: 3,
							entityId: ENTITY_ID,
							entity: { id: ENTITY_ID, name: "Callas", pictureKey: null },
							name: "Tosca",
							status: "confirmed",
						},
					],
				},
			],
			models: [
				{
					id: 20,
					name: "Cast A",
					roles: [
						{
							id: 4,
							name: "Lead",
							main: true,
							entityId: ENTITY_ID,
							order: 1,
							entity: { id: ENTITY_ID, name: "Callas" },
						},
					],
				},
			],
			mediaLinks: [
				{
					kind: "poster",
					media: {
						id: "11111111-1111-4111-8111-111111111111",
						key: "k",
						label: "Saison 1",
						contentType: "image/avif",
					},
				},
			],
		});

		const result = await new SpectaclesService(asRepo(repo)).get(SPECTACLE_ID);

		expect(result).toEqual({
			id: SPECTACLE_ID,
			name: "Tosca",
			workId: WORK_ID,
			description: "Drame lyrique",
			descriptionSource: "https://fr.wikipedia.org/wiki/Tosca",
			links: [{ label: "Wikipédia", url: "https://fr.wikipedia.org/wiki/Tosca" }],
			tracklist: "# Acte 1\n- Recondita armonia",
			performances: [
				{
					id: 10,
					date: "2024-01-01",
					canceled: false,
					seat: "A1",
					posterId: "11111111-1111-4111-8111-111111111111",
					posterUrl: "/images/show/11111111-1111-4111-8111-111111111111",
					place: { id: 7, name: "Old Bastille", country: "fr" },
					spectacle: { id: SPECTACLE_ID, name: "Tosca" },
					roles: [
						{
							id: 3,
							name: "Tosca",
							main: false,
							status: "confirmed",
							order: 0,
							artist: { id: ENTITY_ID, name: "Callas" },
							picture: null,
						},
					],
					casting_status: "ok",
					casting_origin: "manual",
				},
			],
			models: [
				{
					id: 20,
					name: "Cast A",
					roles: [
						{
							id: 4,
							name: "Lead",
							main: true,
							order: 1,
							artist: { id: ENTITY_ID, name: "Callas" },
						},
					],
				},
			],
			media: [
				{
					id: "11111111-1111-4111-8111-111111111111",
					label: "Saison 1",
					contentType: "image/avif",
					url: "/images/show/11111111-1111-4111-8111-111111111111",
					kind: "poster",
				},
			],
		});
	});
});

describe("SpectaclesService.save", () => {
	it("saves through the repository", async () => {
		const repo = fakeRepo();
		const data = { id: SPECTACLE_ID, name: "Tosca", workId: WORK_ID, links: [], tracklist: "# Acte 1" };
		repo.save.mockResolvedValue(data);
		expect(await new SpectaclesService(asRepo(repo)).save(data)).toEqual(data);
		expect(repo.save).toHaveBeenCalledWith(data);
	});
});
