import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../episode-feed.client.js", () => ({ fetchLatestEpisodes: vi.fn() }));

import { BadRequestError, UpstreamError } from "../../common/errors.js";
import { BroadcastRepository } from "../broadcast.repository.js";
import { fetchLatestEpisodes } from "../episode-feed.client.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";
import { LatestService } from "./latest.service.js";

const fetchLatest = vi.mocked(fetchLatestEpisodes);
const now = () => Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 });

describe("LatestService", () => {
	let service: LatestService;
	const repo = { findById: vi.fn() };
	const cache = { get: vi.fn(), set: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [
				LatestService,
				{ provide: BroadcastRepository, useValue: repo },
				{ provide: LatestEpisodesCache, useValue: cache },
			],
		}).compile();
		service = ref.get(LatestService);
	});

	it("returns a fresh cached value without reading the program nor the feed", async () => {
		const cached = { dateTimeUtc: now(), type: "rss", latestEpisodes: [{ id: "e1" }] };
		cache.get.mockReturnValue(cached);

		expect(await service.latestForProgram("p1", undefined)).toBe(cached);
		expect(repo.findById).not.toHaveBeenCalled();
		expect(fetchLatest).not.toHaveBeenCalled();
	});

	it("refetches a cached value older than 2 hours", async () => {
		const old = Temporal.Now.plainDateTimeISO().subtract({ hours: 3 }).toString({ fractionalSecondDigits: 0 });
		cache.get.mockReturnValue({ dateTimeUtc: old, type: "rss", latestEpisodes: [] });
		repo.findById.mockResolvedValue({ id: "p1", refs: { rss: "http://feed" }, episodes: [] });
		fetchLatest.mockResolvedValue([]);

		await service.latestForProgram("p1", undefined);

		expect(fetchLatest).toHaveBeenCalled();
	});

	it("reads the rss feed first, flags the episodes already saved, and caches the result", async () => {
		repo.findById.mockResolvedValue({
			id: "p1",
			refs: { youtubeChannelId: "UC1", rss: "http://feed" },
			episodes: [{ externalId: "e1" }],
		});
		fetchLatest.mockResolvedValue([{ id: "e1" }, { id: "e2" }] as never);

		const result = await service.latestForProgram("p1", undefined);

		expect(fetchLatest).toHaveBeenCalledWith("http://feed", "rss");
		expect(result.latestEpisodes.map(({ id, view }) => [id, view])).toEqual([
			["e1", true],
			["e2", false],
		]);
		expect(cache.set).toHaveBeenCalledWith("p1", result);
	});

	it("reads the forced source, even with a fresh cached value", async () => {
		cache.get.mockReturnValue({ dateTimeUtc: now(), type: "rss", latestEpisodes: [] });
		repo.findById.mockResolvedValue({
			id: "p1",
			refs: { youtubeChannelId: "UC1", rss: "http://feed" },
			episodes: [],
		});
		fetchLatest.mockResolvedValue([]);

		await service.latestForProgram("p1", "youtubeChannelId");

		expect(fetchLatest).toHaveBeenCalledWith("UC1", "youtubeChannelId");
	});

	it("rejects a program without a feed with BadRequestError", async () => {
		repo.findById.mockResolvedValue({ id: "p1", refs: {}, episodes: [] });
		await expect(service.latestForProgram("p1", undefined)).rejects.toBeInstanceOf(BadRequestError);
	});

	it("rejects with UpstreamError when the feed can't be read", async () => {
		fetchLatest.mockRejectedValue(new Error("timeout"));
		await expect(service.latest({ url: "http://feed", type: "rss" })).rejects.toBeInstanceOf(UpstreamError);
	});
});
