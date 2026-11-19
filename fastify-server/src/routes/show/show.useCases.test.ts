import { describe, expect, it, vi } from "vitest";

import type { ArtistRepository } from "./artists/artist.repository";
import type { PerformanceRepository } from "./performances/performance.repository";
import type { PlaceRepository } from "./places/place.repository";
import type { SpectacleRepository } from "./spectacles/spectacle.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { GetReportUseCase, ShowUseCase } from "./show.useCases";

describe("ShowUseCase", () => {
	it("returns nothing for an empty search", async () => {
		const useCase = new ShowUseCase({} as SpectacleRepository, {} as ArtistRepository, {} as PlaceRepository);
		expect(await useCase.execute("", asLog(makeLog()))).toEqual([]);
	});

	it("tags and describes each result kind", async () => {
		const spectacleRepo = {
			findByName: vi.fn().mockResolvedValue([{ id: 1, name: "Tosca", performance: [{}, {}] }]),
		};
		const artistRepo = { findByName: vi.fn().mockResolvedValue([{ id: 2, name: "Callas", role: [{}] }]) };
		const placeRepo = { findByName: vi.fn().mockResolvedValue([{ id: 3, name: "Bastille" }]) };

		const useCase = new ShowUseCase(
			spectacleRepo as unknown as SpectacleRepository,
			artistRepo as unknown as ArtistRepository,
			placeRepo as unknown as PlaceRepository,
		);

		expect(await useCase.execute("to", asLog(makeLog()))).toEqual([
			{ id: 1, name: "Tosca", performance: [{}, {}], description: "2 représentations", type: "spectacle" },
			{ id: 2, name: "Callas", role: [{}], description: "1 représentations", type: "artist" },
			{ id: 3, name: "Bastille", type: "place" },
		]);
	});
});

describe("GetReportUseCase", () => {
	function build(performances: unknown[]) {
		const repo = { findAll: vi.fn().mockResolvedValue(performances) };
		return new GetReportUseCase(repo as unknown as PerformanceRepository);
	}

	it("returns an empty report when there are no performances", async () => {
		expect(await build([]).execute({ from: "2024-01-01", to: "2024-12-31" }, asLog(makeLog()))).toEqual({
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

		const report = await build(performances).execute({ from: "2024-01-01", to: "2024-12-31" }, asLog(makeLog()));

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
