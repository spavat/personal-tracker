import { describe, expect, it, vi } from "vitest";

import type { ArtistsRepository } from "./artists.repository.js";

import { ArtistsService } from "./artists.service.js";

function fakeRepo() {
	return {
		findByIdWithPerformances: vi.fn().mockResolvedValue(null),
		findModelRoles: vi.fn().mockResolvedValue([]),
		findByName: vi.fn().mockResolvedValue([]),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ArtistsRepository;
const ARTIST_ID = "00000000-0000-4000-8000-000000000001";

describe("ArtistsService.get", () => {
	it("returns null when the artist is unknown", async () => {
		const repo = fakeRepo();
		expect(await new ArtistsService(asRepo(repo)).get({ artistId: ARTIST_ID, groupBySpectacle: false })).toBeNull();
	});

	it("flattens roles into a single performances group with stats (not grouped by spectacle)", async () => {
		const repo = fakeRepo();
		repo.findByIdWithPerformances.mockResolvedValue({
			id: ARTIST_ID,
			kind: "person",
			name: "Callas",
			sortName: null,
			pictureKey: null,
			showRoles: [
				{
					name: "Tosca",
					performance: {
						id: 10,
						date: "2024-01-01",
						canceled: false,
						seat: "A1",
						spectacleId: 100,
						spectacle: { id: 100, name: "Tosca" },
						placeName: "Old Bastille",
						place: { id: 7, name: "Bastille", country: "fr" },
					},
				},
				{
					name: "Norma",
					performance: {
						id: 11,
						date: "2024-03-01",
						canceled: false,
						seat: "B2",
						spectacleId: 100,
						spectacle: { id: 100, name: "Tosca" },
						placeName: "Bastille",
						place: { id: 7, name: "Bastille", country: "fr" },
					},
				},
			],
		});

		const result = (await new ArtistsService(asRepo(repo)).get({
			artistId: ARTIST_ID,
			groupBySpectacle: false,
		})) as any;

		expect(result).toMatchObject({
			id: ARTIST_ID,
			kind: "person",
			name: "Callas",
			sortName: null,
			picture: null,
			stats: { nbPerformances: 2, nbSpectacles: 1, lastPerformance: "2024-03-01" },
		});
		expect(result.groups).toHaveLength(1);
		expect(result.groups[0].performances.map((p: any) => p.id)).toEqual([10, 11]);
		expect(result.groups[0].performances[0]).toMatchObject({
			role: "Tosca",
			place: { id: 7, name: "Old Bastille", country: "fr" },
			spectacle: { id: 100, name: "Tosca" },
		});
		expect(result.groups[0].performances[1]).toMatchObject({ place: { name: "Bastille" } });
	});
});
