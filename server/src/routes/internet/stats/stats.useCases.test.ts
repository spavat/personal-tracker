import { describe, expect, it, vi } from "vitest";

import type { InternetRepository } from "../internet.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { GetStatsUseCase } from "./stats.useCases";

function fakeRepo() {
	return { findStatsRaw: vi.fn().mockResolvedValue([]) };
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as InternetRepository;

describe("GetStatsUseCase", () => {
	it("aggregates per-program and per-tag durations over a past period", async () => {
		const repo = fakeRepo();
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

		const result = await new GetStatsUseCase(asRepo(repo)).execute(
			{
				from: "2020-01-01",
				to: "2020-01-10",
			} as any,
			asLog(makeLog()),
		);

		expect(result).toEqual({
			summary: { averageByDays: 9, total: 90, nbPrograms: 1, nbEpisodes: 2, nbDays: 10, inProgress: false },
			programs: [{ name: "P", duration: 90 }],
			tags: [
				{ name: "news", duration: 90, details: [{ name: "Prog", duration: 90 }] },
				{ name: "special", duration: 30, details: [{ name: "Prog", duration: 30 }] },
			],
		});
	});
});
