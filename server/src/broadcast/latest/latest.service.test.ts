import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../sources/episode-feed.client.js", () => ({ fetchLatestEpisodes: vi.fn() }));

import { BadRequestError, UpstreamError } from "../../common/errors.js";
import { BroadcastRepository } from "../broadcast.repository.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";
import { fetchLatestEpisodes } from "../sources/episode-feed.client.js";
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

	it("answers a fresh cached value without reading the feed, its flags read anew", async () => {
		const cached = { dateTimeUtc: now(), type: "rss", latestEpisodes: [{ id: "e1", view: false }] };
		cache.get.mockReturnValue(cached);
		repo.findById.mockResolvedValue({
			id: "p1",
			refs: { rss: "http://feed" },
			episodes: [{ externalId: "e1", status: "planned", views: [] }],
		});

		const result = await service.latestForProgram("p1", undefined);

		expect(result.latestEpisodes).toEqual([{ id: "e1", view: false, status: "planned" }]);
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

	it("reads the rss feed first, flags the episodes watched and their status, and caches the feed", async () => {
		repo.findById.mockResolvedValue({
			id: "p1",
			refs: { youtubeChannelId: "UC1", rss: "http://feed" },
			episodes: [
				{ externalId: "e1", views: [{ id: "v1" }] },
				// imported in a catalog, never watched
				{ externalId: "e2", views: [] },
				{ externalId: "e3", status: "skipped", views: [] },
			],
		});
		fetchLatest.mockResolvedValue([{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }] as never);

		const result = await service.latestForProgram("p1", undefined);

		expect(fetchLatest).toHaveBeenCalledWith("http://feed", "rss");
		expect(result.latestEpisodes.map(({ id, view, status }) => [id, view, status])).toEqual([
			["e1", true, undefined],
			["e2", false, undefined],
			["e3", false, "skipped"],
			["e4", false, undefined],
		]);
		expect(cache.set).toHaveBeenCalledWith(
			"p1",
			expect.objectContaining({ latestEpisodes: [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }] }),
		);
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
