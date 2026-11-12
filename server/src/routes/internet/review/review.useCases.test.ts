import { describe, expect, it, vi } from "vitest";

import type { InternetRepository } from "../internet.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { ListUntaggedEpisodesUseCase } from "./review.useCases";

function fakeRepo() {
	return { findAllWithEpisodes: vi.fn().mockResolvedValue([]) };
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as InternetRepository;

describe("ListUntaggedEpisodesUseCase", () => {
	it("lists the episodes without any tag, most recent first", async () => {
		const repo = fakeRepo();
		repo.findAllWithEpisodes.mockResolvedValue([
			{
				id: "p1",
				name: "Tagged program",
				tags: ["news"],
				episodes: [
					{ id: "e1", date: "2020-01-01", tags: [] },
					{ id: "e2", date: "2020-01-02", ignoredTags: ["news"], contextTags: ["car"] },
				],
			},
			{
				id: "p2",
				name: "Untagged program",
				episodes: [
					{ id: "e3", date: "2020-01-03" },
					{ id: "e4", date: "2020-01-04", tags: ["special"] },
				],
			},
		]);

		const result = await new ListUntaggedEpisodesUseCase(asRepo(repo)).execute(asLog(makeLog()));

		expect(result).toEqual([
			{ programId: "p2", programName: "Untagged program", episode: { id: "e3", date: "2020-01-03" } },
			{
				programId: "p1",
				programName: "Tagged program",
				episode: { id: "e2", date: "2020-01-02", ignoredTags: ["news"], contextTags: ["car"] },
			},
		]);
	});
});
