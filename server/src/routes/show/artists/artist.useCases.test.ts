import { describe, expect, it, vi } from "vitest";

import type { ArtistRepository } from "./artist.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { DeleteArtistUseCase, GetArtistUseCase, ListArtistsUseCase, SaveArtistUseCase } from "./artist.useCases";

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

describe("ListArtistsUseCase", () => {
	it("defaults the sort to name asc", async () => {
		const repo = fakeRepo();
		await new ListArtistsUseCase(asRepo(repo)).execute(undefined, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "name", sortDirection: "asc" });
	});

	it("forwards an explicit sort tuple", async () => {
		const repo = fakeRepo();
		await new ListArtistsUseCase(asRepo(repo)).execute(["nbPerformances", "desc"], asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ sortField: "nbPerformances", sortDirection: "desc" });
	});
});

describe("SaveArtistUseCase / DeleteArtistUseCase", () => {
	it("save persists then reports ok", async () => {
		const repo = fakeRepo();
		const data = { name: "Callas" };
		expect(await new SaveArtistUseCase(asRepo(repo)).execute(data as any, asLog(makeLog()))).toEqual({ ok: true });
		expect(repo.save).toHaveBeenCalledWith(data);
	});

	it("delete removes then reports ok", async () => {
		const repo = fakeRepo();
		expect(await new DeleteArtistUseCase(asRepo(repo)).execute(5, asLog(makeLog()))).toEqual({ ok: true });
		expect(repo.delete).toHaveBeenCalledWith(5);
	});
});

describe("GetArtistUseCase", () => {
	it("returns null when the artist is unknown", async () => {
		const repo = fakeRepo();
		expect(
			await new GetArtistUseCase(asRepo(repo)).execute(
				{ artistId: 1, groupBySpectacle: false },
				asLog(makeLog()),
			),
		).toBeNull();
	});

	it("flattens roles into a single performances group with stats (not grouped by spectacle)", async () => {
		const repo = fakeRepo();
		repo.findByIdWithPerformances.mockResolvedValue({
			id: 1,
			name: "Callas",
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

		const result = (await new GetArtistUseCase(asRepo(repo)).execute(
			{ artistId: 1, groupBySpectacle: false },
			asLog(makeLog()),
		)) as any;

		expect(result).toMatchObject({
			id: 1,
			name: "Callas",
			stats: { nbPerformances: 2, nbSpectacles: 1, lastPerformance: "2024-03-01" },
		});
		expect(result.groups).toHaveLength(1);
		expect(result.groups[0].performances.map((p: any) => p.id)).toEqual([10, 11]);
		expect(result.groups[0].performances[0]).toMatchObject({
			role: "Tosca",
			placeName: "Old Bastille",
			spectacleName: "Tosca",
		});
		expect(result.groups[0].performances[1]).toMatchObject({ placeName: "Bastille" });
	});
});
