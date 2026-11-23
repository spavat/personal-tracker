import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BroadcastRepository } from "../broadcast.repository.js";
import { StatsService } from "./stats.service.js";

describe("StatsService", () => {
	let service: StatsService;
	const repo = { findStatsRaw: vi.fn(), findEpisodesInRange: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [StatsService, { provide: BroadcastRepository, useValue: repo }],
		}).compile();
		service = ref.get(StatsService);
	});

	it("sums the durations per program and per tag over a past period, the real duration first", async () => {
		repo.findStatsRaw.mockResolvedValue([
			{
				id: "p1",
				name: "Prog",
				shortName: "P",
				tags: ["news"],
				episodes: [
					{ duration: 60, tags: [] },
					{ duration: 60, durationReal: 30, tags: ["special"] },
				],
			},
		]);

		expect(await service.stats({ from: "2020-01-01", to: "2020-01-10" })).toEqual({
			summary: { averageByDays: 9, total: 90, nbPrograms: 1, nbEpisodes: 2, nbDays: 10, inProgress: false },
			programs: [{ name: "P", duration: 90 }],
			tags: [
				{ name: "news", duration: 90, details: [{ name: "Prog", duration: 90 }] },
				{ name: "special", duration: 30, details: [{ name: "Prog", duration: 30 }] },
			],
		});
	});

	it("leaves out the program tags an episode ignores, and counts a shared tag once", async () => {
		repo.findStatsRaw.mockResolvedValue([
			{
				id: "p1",
				name: "Prog",
				tags: ["news", "tech"],
				episodes: [
					{ duration: 60, tags: ["news"] },
					{ duration: 30, tags: ["special"], ignoredTags: ["news"] },
				],
			},
		]);

		const { tags } = await service.stats({ from: "2020-01-01", to: "2020-01-10" });

		expect(tags.map(({ name, duration }) => [name, duration])).toEqual([
			["tech", 90],
			["news", 60],
			["special", 30],
		]);
	});

	it("fortnight gives 14 days ending today, the empty days at 0", async () => {
		const today = Temporal.Now.plainDateISO().toString();
		repo.findEpisodesInRange.mockResolvedValue([{ episodes: [{ date: today, duration: 40, durationReal: 25 }] }]);

		const days = await service.fortnight();

		expect(days).toHaveLength(14);
		expect(days.at(-1)).toEqual({ date: today, duration: 25 });
		expect(days[0].duration).toBe(0);
	});
});
