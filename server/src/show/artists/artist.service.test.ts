import { describe, expect, it, vi } from "vitest";

import type { ArtistRepository } from "./artist.repository.js";

import { ArtistService } from "./artist.service.js";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findByIdWithPerformances: vi.fn().mockResolvedValue(null),
		findByName: vi.fn().mockResolvedValue([]),
		save: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ArtistRepository;

describe("ArtistService.list", () => {
	it("defaults the sort to name asc", async () => {
		const repo = fakeRepo();
		await new ArtistService(asRepo(repo)).list(undefined);
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "name", sortDirection: "asc" });
	});

	it("forwards an explicit sort tuple", async () => {
		const repo = fakeRepo();
		await new ArtistService(asRepo(repo)).list(["nbPerformances", "desc"]);
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "nbPerformances", sortDirection: "desc" });
	});
});

describe("ArtistService.save / delete", () => {
	it("save persists then returns the saved artist view", async () => {
		const repo = fakeRepo();
		repo.save.mockResolvedValue({ id: 7, name: "Callas", pictureId: null });
		const data = { name: "Callas" };
		expect(await new ArtistService(asRepo(repo)).save(data as any)).toEqual({
			id: 7,
			name: "Callas",
			pictureId: null,
			pictureUrl: null,
		});
		expect(repo.save).toHaveBeenCalledWith(data);
	});

	it("save returns null when updating an unknown artist", async () => {
		const repo = fakeRepo();
		expect(await new ArtistService(asRepo(repo)).save({ id: 5, name: "X" })).toBeNull();
	});

	it("delete removes the artist", async () => {
		const repo = fakeRepo();
		await new ArtistService(asRepo(repo)).delete(5);
		expect(repo.delete).toHaveBeenCalledWith(5);
	});
});

describe("ArtistService.get", () => {
	it("returns null when the artist is unknown", async () => {
		const repo = fakeRepo();
		expect(await new ArtistService(asRepo(repo)).get({ artistId: 1, groupBySpectacle: false })).toBeNull();
	});

	it("flattens roles into a single performances group with stats (not grouped by spectacle)", async () => {
		const repo = fakeRepo();
		repo.findByIdWithPerformances.mockResolvedValue({
			id: 1,
			name: "Callas",
			pictureId: "22222222-2222-4222-8222-222222222222",
			mediaLinks: [
				{
					spectacleId: 100,
					media: {
						id: "22222222-2222-4222-8222-222222222222",
						key: "k",
						label: "",
						contentType: "image/avif",
					},
				},
			],
			role: [
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

		const result = (await new ArtistService(asRepo(repo)).get({ artistId: 1, groupBySpectacle: false })) as any;

		expect(result).toMatchObject({
			id: 1,
			name: "Callas",
			pictureId: "22222222-2222-4222-8222-222222222222",
			pictureUrl: "/images/show/22222222-2222-4222-8222-222222222222",
			media: [
				{
					id: "22222222-2222-4222-8222-222222222222",
					label: "",
					contentType: "image/avif",
					url: "/images/show/22222222-2222-4222-8222-222222222222",
					spectacleId: 100,
				},
			],
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
