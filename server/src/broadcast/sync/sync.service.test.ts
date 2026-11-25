import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../sources/episode-feed.client.js", () => ({
	fetchLatestEpisodes: vi.fn().mockResolvedValue([]),
	fetchPodcastTitle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./sync.entity.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("./sync.entity.js")>()),
	extractListenedEpisodesFromBuffer: vi.fn().mockReturnValue([]),
}));

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { BroadcastImagesStorage } from "../broadcast-images.storage.js";
import { BroadcastRepository } from "../broadcast.repository.js";
import { BroadcastService } from "../broadcast.service.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";
import { fetchLatestEpisodes, fetchPodcastTitle } from "../sources/episode-feed.client.js";
import { GopodderClient } from "./gopodder.client.js";
import { SyncStateRepository } from "./sync-state.repository.js";
import { extractListenedEpisodesFromBuffer } from "./sync.entity.js";
import { SyncRepository } from "./sync.repository.js";
import { SyncService } from "./sync.service.js";

const fetchLatest = vi.mocked(fetchLatestEpisodes);
const fetchTitle = vi.mocked(fetchPodcastTitle);
const extract = vi.mocked(extractListenedEpisodesFromBuffer);

const PROGRAM = "11111111-1111-4111-8111-111111111111";
const EPISODE_1 = { id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" };
const LISTENED = {
	episodeId: "guid-1",
	episodeTitle: "Episode 1",
	podcastTitle: "Prog",
	podcastUrl: "http://feed",
	listenedAtIso: "2026-10-01T20:00:00Z",
	duration: 3_600_000,
	playedDuration: 1_800_000,
	percentListened: 50,
};
const PLAY = {
	podcast: "http://feed",
	episode: "http://feed/ep1.mp3",
	guid: "guid-1",
	action: "play",
	timestamp: "2026-11-12T19:00:00",
	started: 0,
	position: 1800,
	total: 3600,
};

describe("SyncService", () => {
	let service: SyncService;
	const repo = { findByRssUrl: vi.fn(), findById: vi.fn(), setRssRef: vi.fn(), findFormats: vi.fn() };
	const syncRepo = {
		count: vi.fn(),
		insertMany: vi.fn(),
		findAllWithSource: vi.fn(),
		findByPodcastUrl: vi.fn(),
		findWithoutProposition: vi.fn(),
		deleteByPodcastUrl: vi.fn(),
		replace: vi.fn(),
		delete: vi.fn(),
	};
	const stateRepo = { getGopodderSince: vi.fn(), setGopodderSince: vi.fn() };
	const cache = { get: vi.fn(), set: vi.fn() };
	const broadcast = { createProgram: vi.fn(), createEpisode: vi.fn() };
	// an injected provider: no module mock needed
	const gopodder = { fetchEpisodeActions: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		repo.findFormats.mockResolvedValue([]);
		fetchLatest.mockResolvedValue([]);
		fetchTitle.mockResolvedValue(undefined);
		extract.mockReturnValue([]);
		repo.findByRssUrl.mockResolvedValue({ id: "p1", name: "Prog", episodes: [] });
		syncRepo.count.mockResolvedValue(0);
		syncRepo.findAllWithSource.mockResolvedValue([]);
		syncRepo.findByPodcastUrl.mockResolvedValue([]);
		const ref = await Test.createTestingModule({
			providers: [
				SyncService,
				{ provide: BroadcastRepository, useValue: repo },
				{ provide: SyncRepository, useValue: syncRepo },
				{ provide: SyncStateRepository, useValue: stateRepo },
				{ provide: LatestEpisodesCache, useValue: cache },
				{ provide: BroadcastImagesStorage, useValue: { resolveImages: (item: object) => item } },
				{ provide: BroadcastService, useValue: broadcast },
				{ provide: GopodderClient, useValue: gopodder },
			],
		}).compile();
		service = ref.get(SyncService);
	});

	describe("AntennaPod upload", () => {
		it("stores one proposal per listened episode, fetching each feed once", async () => {
			extract.mockReturnValue([LISTENED, { ...LISTENED, episodeId: "guid-unknown" }]);
			fetchLatest.mockResolvedValue([EPISODE_1] as never);

			expect(await service.uploadAntennaPod(new Uint8Array([1]))).toEqual({ count: 2 });

			expect(fetchLatest).toHaveBeenCalledTimes(1);
			const [proposals] = syncRepo.insertMany.mock.calls[0];
			expect(proposals[0]).toMatchObject({
				listened: LISTENED,
				origin: { externalId: "guid-1", datetime: "2026-10-01T22:00:00" },
				proposition: { programId: "p1", name: "Episode 1", duration: 60, durationReal: 30, date: "2026-10-01" },
			});
			expect(proposals[0].proposition).not.toHaveProperty("programProfile");
			expect(proposals[1].proposition).toBeUndefined();
		});

		it("pre-selects the first format, in order, whose match rule fits the title (case ignored)", async () => {
			repo.findFormats.mockResolvedValue([
				{ id: "f2", position: 2, label: "Épisode", match: "episode" },
				{ id: "broken", position: 0, label: "Cassé", match: "(" },
				{ id: "f1", position: 1, label: "Bonus", match: "^EPISODE \\d$" },
			]);
			extract.mockReturnValue([LISTENED]);
			fetchLatest.mockResolvedValue([EPISODE_1] as never);

			await service.uploadAntennaPod(new Uint8Array([1]));

			// the invalid rule is skipped, f1 comes before f2
			expect(syncRepo.insertMany.mock.calls[0][0][0].proposition).toMatchObject({ formatId: "f1" });
		});

		it("flags an episode already saved in the program, without skipping it: the proposal keeps its fields", async () => {
			repo.findByRssUrl.mockResolvedValue({
				id: "p1",
				name: "Prog",
				episodes: [
					{
						externalId: "guid-1",
						name: "Saved title",
						duration: 40,
						type: "podcast",
						seasonId: "s1",
						numberLabel: "3",
						position: 3,
						releaseDate: "2026-08-01",
						description: "Saved description",
						cover: "/images/broadcast/episode/e1?v=abc",
						views: [{ date: "2026-09-01" }, { date: "2026-09-15" }],
					},
					{ externalId: "other", views: [{ date: "2026-09-20" }] },
				],
			});
			extract.mockReturnValue([LISTENED]);
			fetchLatest.mockResolvedValue([EPISODE_1] as never);

			await service.uploadAntennaPod(new Uint8Array([1]));

			expect(syncRepo.insertMany.mock.calls[0][0][0]).toMatchObject({
				alreadySaved: { date: "2026-09-15" },
				proposition: {
					name: "Saved title",
					duration: 40,
					seasonId: "s1",
					numberLabel: "3",
					position: 3,
					releaseDate: "2026-08-01",
					description: "Saved description",
					// the stored cover, kept when the proposal is validated
					cover: "/images/broadcast/episode/e1?v=abc",
					externalId: "guid-1",
				},
			});
		});

		it("proposes a view of an imported episode the latest episodes no longer hold", async () => {
			repo.findByRssUrl.mockResolvedValue({
				id: "p1",
				name: "Prog",
				episodes: [{ externalId: "guid-1", name: "Old release", duration: 40, type: "podcast", views: [] }],
			});
			extract.mockReturnValue([LISTENED]);
			fetchLatest.mockResolvedValue([] as never);

			await service.uploadAntennaPod(new Uint8Array([1]));

			const [proposal] = syncRepo.insertMany.mock.calls[0][0];
			expect(proposal.alreadySaved).toBeUndefined();
			expect(proposal.proposition).toMatchObject({ programId: "p1", name: "Old release", externalId: "guid-1" });
		});

		it("is refused with ConflictError while proposals already exist", async () => {
			syncRepo.count.mockResolvedValue(1);
			await expect(service.uploadAntennaPod(new Uint8Array([1]))).rejects.toBeInstanceOf(ConflictError);
			expect(extract).not.toHaveBeenCalled();
		});
	});

	describe("reprocess", () => {
		it("rebuilds each proposal from its source, ignoring the cache", async () => {
			cache.get.mockReturnValue({ latestEpisodes: [] });
			syncRepo.findAllWithSource.mockResolvedValue([
				{ id: "s1", listened: LISTENED, proposition: { name: "stale" } },
			]);
			fetchLatest.mockResolvedValue([EPISODE_1] as never);

			await service.reprocess();

			expect(cache.get).not.toHaveBeenCalled();
			expect(syncRepo.replace).toHaveBeenCalledWith(
				expect.objectContaining({ id: "s1", proposition: expect.objectContaining({ name: "Episode 1" }) }),
			);
		});

		it("drops a stale proposition when no program has the feed anymore", async () => {
			repo.findByRssUrl.mockResolvedValue(null);
			syncRepo.findAllWithSource.mockResolvedValue([
				{ id: "s1", listened: LISTENED, proposition: { name: "stale" } },
			]);

			await service.reprocess();

			expect(syncRepo.replace.mock.calls[0][0]).not.toHaveProperty("proposition");
		});

		it("with a feed, only rebuilds that feed's proposals", async () => {
			syncRepo.findByPodcastUrl.mockResolvedValue([{ id: "s1", listened: LISTENED }]);

			await service.reprocess("http://feed");

			expect(syncRepo.findAllWithSource).not.toHaveBeenCalled();
			expect(syncRepo.replace).toHaveBeenCalledTimes(1);
		});
	});

	describe("feeds", () => {
		it("lists the unknown feeds of the proposals without proposition", async () => {
			syncRepo.findWithoutProposition.mockResolvedValue([
				{ id: "s1", listened: { ...LISTENED, podcastUrl: "http://unknown", podcastTitle: "Zeta" } },
				{ id: "s2", listened: { ...LISTENED, podcastUrl: "http://unknown", podcastTitle: "Zeta" } },
				{ id: "s3", listened: { ...LISTENED, podcastUrl: "http://untitled", podcastTitle: "" } },
				// known program, episode missing from its feed: not an unknown feed
				{ id: "s4", listened: LISTENED },
			]);
			repo.findByRssUrl.mockImplementation(async (url: string) =>
				url === "http://feed" ? { id: "p1", episodes: [] } : null,
			);

			expect(await service.unknownFeeds()).toEqual([
				{ rssUrl: "http://untitled", title: "http://untitled", count: 1 },
				{ rssUrl: "http://unknown", title: "Zeta", count: 2 },
			]);
		});

		it("linking a feed replaces the program's rss ref, then rebuilds that feed's proposals", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM });
			syncRepo.findByPodcastUrl.mockResolvedValue([{ id: "s1", listened: LISTENED }]);

			await service.linkFeed("http://feed", PROGRAM);

			expect(repo.setRssRef).toHaveBeenCalledWith(PROGRAM, "http://feed");
			expect(syncRepo.replace).toHaveBeenCalledTimes(1);
		});

		it("linking a feed to a missing program is refused with NotFoundError", async () => {
			repo.findById.mockResolvedValue(null);
			await expect(service.linkFeed("http://feed", PROGRAM)).rejects.toBeInstanceOf(NotFoundError);
			expect(repo.setRssRef).not.toHaveBeenCalled();
		});

		it("ignoring a feed deletes its proposals", async () => {
			syncRepo.deleteByPodcastUrl.mockResolvedValue({ deletedCount: 2 });
			expect(await service.ignoreFeed("http://unknown")).toEqual({ count: 2 });
		});
	});

	it("validate saves the episode, then drops the proposal", async () => {
		const episode = { name: "Ep" };
		broadcast.createEpisode.mockResolvedValue({ id: "e1", ...episode });

		expect(await service.validate("s1", { programId: PROGRAM, episode } as never)).toEqual({
			id: "e1",
			...episode,
		});
		expect(broadcast.createEpisode).toHaveBeenCalledWith(PROGRAM, episode);
		expect(syncRepo.delete).toHaveBeenCalledWith("s1");
	});

	it("validate creates a new program with its episode", async () => {
		const body = { program: { name: "Prog" }, episode: { name: "Ep" } };
		broadcast.createProgram.mockResolvedValue({ id: PROGRAM });

		await service.validate("s1", body as never);
		expect(broadcast.createProgram).toHaveBeenCalledWith(body);
	});

	describe("gopodder", () => {
		it("the first sync only records the starting point (AntennaPod's first upload holds the whole history)", async () => {
			stateRepo.getGopodderSince.mockResolvedValue(undefined);
			gopodder.fetchEpisodeActions.mockResolvedValue({ actions: [PLAY], timestamp: 1794500000 });

			expect(await service.syncGopodder()).toEqual({ count: 0, initialized: true });
			expect(stateRepo.setGopodderSince).toHaveBeenCalledWith(1794500000);
			expect(syncRepo.insertMany).not.toHaveBeenCalled();
		});

		it("next syncs build proposals from the new actions, then advance since", async () => {
			stateRepo.getGopodderSince.mockResolvedValue(1794400000);
			gopodder.fetchEpisodeActions.mockResolvedValue({ actions: [PLAY], timestamp: 1794500000 });
			fetchTitle.mockResolvedValue("Prog");
			fetchLatest.mockResolvedValue([EPISODE_1] as never);

			expect(await service.syncGopodder()).toEqual({ count: 1 });

			expect(gopodder.fetchEpisodeActions).toHaveBeenCalledWith(1794400000);
			expect(syncRepo.insertMany.mock.calls[0][0][0]).toMatchObject({
				origin: { program: "Prog", episode: "Episode 1", datetime: "2026-11-12T20:00:00", listened: "30min" },
				proposition: { programId: "p1", name: "Episode 1", duration: 60, durationReal: 30, date: "2026-11-12" },
			});
			expect(stateRepo.setGopodderSince).toHaveBeenCalledWith(1794500000);
		});

		it("falls back to the feed url when the feed can't be read", async () => {
			stateRepo.getGopodderSince.mockResolvedValue(1794400000);
			gopodder.fetchEpisodeActions.mockResolvedValue({ actions: [PLAY], timestamp: 1794500000 });
			fetchTitle.mockRejectedValue(new Error("down"));
			fetchLatest.mockRejectedValue(new Error("down"));

			await service.syncGopodder();

			expect(syncRepo.insertMany.mock.calls[0][0][0].origin).toMatchObject({
				program: "http://feed",
				episode: "",
			});
		});

		it("is refused while proposals already exist, without calling gopodder", async () => {
			syncRepo.count.mockResolvedValue(3);
			await expect(service.syncGopodder()).rejects.toBeInstanceOf(ConflictError);
			expect(gopodder.fetchEpisodeActions).not.toHaveBeenCalled();
		});

		it("status gives the last sync in Paris local time, null before the first one", async () => {
			stateRepo.getGopodderSince.mockResolvedValueOnce(1794500000).mockResolvedValueOnce(undefined);
			expect(await service.gopodderStatus()).toEqual({ lastSync: "2026-11-12T17:13:20" });
			expect(await service.gopodderStatus()).toEqual({ lastSync: null });
		});
	});
});
