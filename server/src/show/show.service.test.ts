import { describe, expect, it, vi } from "vitest";

import type { ArtistRepository } from "./artists/artist.repository.js";
import type { PerformanceRepository } from "./performances/performance.repository.js";
import type { PlaceRepository } from "./places/place.repository.js";
import type { SpectacleRepository } from "./spectacles/spectacle.repository.js";

import { ShowService } from "./show.service.js";

describe("ShowService.search", () => {
	it("returns nothing for an empty search", async () => {
		const service = new ShowService(
			{} as SpectacleRepository,
			{} as ArtistRepository,
			{} as PlaceRepository,
			{} as PerformanceRepository,
		);
		expect(await service.search("")).toEqual([]);
	});

	it("tags and describes each result kind", async () => {
		const spectacleRepo = {
			findByName: vi.fn().mockResolvedValue([{ id: 1, name: "Tosca", performance: [{}, {}] }]),
		};
		const artistRepo = { findByName: vi.fn().mockResolvedValue([{ id: 2, name: "Callas", role: [{}] }]) };
		const placeRepo = { findByName: vi.fn().mockResolvedValue([{ id: 3, name: "Bastille" }]) };

		const service = new ShowService(
			spectacleRepo as unknown as SpectacleRepository,
			artistRepo as unknown as ArtistRepository,
			placeRepo as unknown as PlaceRepository,
			{} as PerformanceRepository,
		);

		expect(await service.search("to")).toEqual([
			{ id: 1, name: "Tosca", performance: [{}, {}], description: "2 représentations", type: "spectacle" },
			{ id: 2, name: "Callas", role: [{}], description: "1 représentations", type: "artist" },
			{ id: 3, name: "Bastille", type: "place" },
		]);
	});
});

describe("ShowService.report", () => {
	function build(performances: unknown[]) {
		const repo = { findAll: vi.fn().mockResolvedValue(performances) };
		return new ShowService(
			{} as SpectacleRepository,
			{} as ArtistRepository,
			{} as PlaceRepository,
			repo as unknown as PerformanceRepository,
		);
	}

	it("returns an empty report when there are no performances", async () => {
		expect(await build([]).report({ from: "2024-01-01", to: "2024-12-31" })).toEqual({
			hasData: false,
			stats: { spectacles: 0, performances: 0, newSpectacles: 0, countryDistribution: [] },
			periodList: [],
			totalList: [],
		});
	});

	it("ranks spectacles and counts new ones inside the period", async () => {
		const performances = [
			{ date: "2024-05-01", canceled: false, spectacleId: 1, spectacle: "Tosca", country: "fr" },
			{ date: "2024-06-01", canceled: false, spectacleId: 1, spectacle: "Tosca", country: "fr" },
		];

		const report = await build(performances).report({ from: "2024-01-01", to: "2024-12-31" });

		expect(report.hasData).toBe(true);
		expect(report.stats).toEqual({
			spectacles: 1,
			performances: 2,
			newSpectacles: 1,
			countryDistribution: [{ code: "fr", count: 2 }],
		});
		expect(report.periodList).toEqual([
			{ id: 1, name: "Tosca", count: 2, date: "2024-05-01", isNew: true, rank: 1 },
		]);
		expect(report.totalList).toEqual([
			{ id: 1, name: "Tosca", date: "2024-05-01", count: 2, added: 2, move: "", isNew: true, rank: 1 },
		]);
	});
});
