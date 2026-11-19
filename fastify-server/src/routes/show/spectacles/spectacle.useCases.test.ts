import { describe, expect, it, vi } from "vitest";

import type { SpectacleRepository } from "./spectacle.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	GetGroupedSpectaclesUseCase,
	GetSpectacleUseCase,
	ListSpectaclesUseCase,
	SaveSpectacleUseCase,
} from "./spectacle.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findAllWithPerformancesAndPlaces: vi.fn().mockResolvedValue(null),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
		save: vi.fn().mockResolvedValue(undefined),
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
			workId: 2,
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
					spectacleId: 1,
					placeName: "Old Bastille",
					place: { id: 7, name: "Bastille", country: "fr" },
					posterId: "11111111-1111-4111-8111-111111111111",
					// no role portrait: falls back to the artist's main photo
					role: [
						{
							id: 3,
							artistId: 5,
							artist: { name: "Callas", pictureId: "22222222-2222-4222-8222-222222222222" },
							name: "Tosca",
							status: "confirmed",
							pictureId: null,
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
							artistId: 5,
							order: 1,
							artist: { id: 5, name: "Callas" },
							pictureId: "33333333-3333-4333-8333-333333333333",
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

		const result = await new GetSpectacleUseCase(asRepo(repo)).execute(1, asLog(makeLog()));

		expect(result).toEqual({
			id: 1,
			name: "Tosca",
			workId: 2,
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
					spectacle: { id: 1, name: "Tosca" },
					roles: [
						{
							id: 3,
							name: "Tosca",
							main: false,
							status: "confirmed",
							order: 0,
							pictureId: null,
							artist: { id: 5, name: "Callas" },
							pictureUrl: "/images/show/22222222-2222-4222-8222-222222222222",
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
							pictureId: "33333333-3333-4333-8333-333333333333",
							artist: { id: 5, name: "Callas" },
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

describe("SaveSpectacleUseCase", () => {
	it("saves through the repository", async () => {
		const repo = fakeRepo();
		const data = { id: 1, name: "Tosca", workId: 2, links: [], tracklist: "# Acte 1" };
		repo.save.mockResolvedValue(data);
		expect(await new SaveSpectacleUseCase(asRepo(repo)).execute(data, asLog(makeLog()))).toEqual(data);
		expect(repo.save).toHaveBeenCalledWith(data);
	});
});
