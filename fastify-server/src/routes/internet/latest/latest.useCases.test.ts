import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../fetch-latest", () => ({
	fetchLatestEpisodes: vi.fn().mockResolvedValue([]),
}));

import type { InternetRepository } from "../internet.repository";
import type { LatestEpisodesCacheRepository } from "../latest-episodes-cache.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { fetchLatestEpisodes } from "../fetch-latest";
import { GetLatestEpisodesForProgramUseCase } from "./latest.useCases";

const fetchLatestMock = vi.mocked(fetchLatestEpisodes);

function fakeRepo() {
	return { findById: vi.fn().mockResolvedValue(null) };
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as InternetRepository;

beforeEach(() => {
	fetchLatestMock.mockReset();
	fetchLatestMock.mockResolvedValue([]);
});

describe("GetLatestEpisodesForProgramUseCase", () => {
	function build() {
		const repo = fakeRepo();
		const cache = { get: vi.fn().mockReturnValue(undefined), set: vi.fn() };
		const useCase = new GetLatestEpisodesForProgramUseCase(
			asRepo(repo),
			cache as unknown as LatestEpisodesCacheRepository,
		);
		return { useCase, repo, cache };
	}

	it("returns a fresh cached value without hitting the network", async () => {
		const { useCase, repo, cache } = build();
		const cached = {
			dateTimeUtc: Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 }),
			type: "rss",
			latestEpisodes: [{ id: "e1" }],
		};
		cache.get.mockReturnValue(cached);

		expect(await useCase.execute("p1", undefined, asLog(makeLog()))).toBe(cached);
		expect(repo.findById).not.toHaveBeenCalled();
		expect(fetchLatestMock).not.toHaveBeenCalled();
	});

	it("fetches and caches when there is no cached value", async () => {
		const { useCase, repo, cache } = build();
		repo.findById.mockResolvedValue({ id: "p1", name: "Prog", refs: { rss: "http://feed" }, episodes: [] });
		fetchLatestMock.mockResolvedValue([{ id: "e1" }] as never);

		const result = await useCase.execute("p1", undefined, asLog(makeLog()));

		expect(fetchLatestMock).toHaveBeenCalledWith("http://feed", "rss");
		expect(result).toMatchObject({ type: "rss", latestEpisodes: [{ id: "e1" }] });
		expect(cache.set).toHaveBeenCalledWith("p1", result);
	});

	it("throws when the program has no usable ref", async () => {
		const { useCase, repo } = build();
		repo.findById.mockResolvedValue({ id: "p1", name: "Prog", refs: {} });
		await expect(useCase.execute("p1", undefined, asLog(makeLog()))).rejects.toThrow("Config invalide");
	});
});
