import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fetch-latest", () => ({
	fetchLatestEpisodes: vi.fn().mockResolvedValue([]),
	getPodcastCoverImageUrl: vi.fn().mockResolvedValue(undefined),
	fetchPodcastTitle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./gopodder", () => ({
	fetchEpisodeActions: vi.fn(),
}));
vi.mock("./extractor", () => ({
	getFranceTvVideoInfo: vi.fn(),
	getRawHTML: vi.fn(),
	getYoutubeChannelInfo: vi.fn(),
	getYoutubeVideoInfo: vi.fn(),
}));
vi.mock("./sync.entity", async (importOriginal) => ({
	...(await importOriginal<typeof import("./sync.entity")>()),
	extractListenedEpisodesFromBuffer: vi.fn().mockReturnValue([]),
}));

import type { ImageStorageRepository } from "./image-storage.repository";
import type { InternetRepository } from "./internet.repository";
import type { LatestEpisodesCacheRepository } from "./latest-episodes-cache.repository";
import type { SyncStateRepository } from "./sync-state.repository";
import type { SyncRepository } from "./sync.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { getFranceTvVideoInfo } from "./extractor";
import { fetchLatestEpisodes, fetchPodcastTitle } from "./fetch-latest";
import { fetchEpisodeActions } from "./gopodder";
import {
	DeleteEpisodeUseCase,
	ExtractInfoUseCase,
	GetLatestEpisodesForProgramUseCase,
	GetProgramUseCase,
	GetStatsUseCase,
	IgnoreFeedUseCase,
	LinkFeedToProgramUseCase,
	ListEpisodesUseCase,
	ListProgramsUseCase,
	ListUnknownFeedsUseCase,
	ReprocessSyncProposalsUseCase,
	SyncGopodderUseCase,
	UploadAntennaPodUseCase,
} from "./internet.useCases";
import { extractListenedEpisodesFromBuffer } from "./sync.entity";

const fetchLatestMock = vi.mocked(fetchLatestEpisodes);
const extractMock = vi.mocked(extractListenedEpisodesFromBuffer);
const fetchActionsMock = vi.mocked(fetchEpisodeActions);
const fetchTitleMock = vi.mocked(fetchPodcastTitle);

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findEpisodesInRange: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		deleteEpisode: vi.fn().mockResolvedValue({ acknowledged: true }),
		findStatsRaw: vi.fn().mockResolvedValue([]),
	};
}
const passthroughImageStorage = {
	resolveImages: (x: unknown) => x,
} as unknown as ImageStorageRepository;

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as InternetRepository;

beforeEach(() => {
	fetchLatestMock.mockReset();
	fetchLatestMock.mockResolvedValue([]);
	extractMock.mockReset();
	fetchActionsMock.mockReset();
	fetchTitleMock.mockReset();
	fetchTitleMock.mockResolvedValue(undefined);
});

describe("ListProgramsUseCase", () => {
	it("defaults the sort and normalises search", () => {
		const repo = fakeRepo();
		const imageStorage = { resolveImages: vi.fn((p) => ({ ...p, resolved: true })) };
		new ListProgramsUseCase(asRepo(repo), imageStorage as unknown as ImageStorageRepository).execute(
			{} as any,
			asLog(makeLog()),
		);
		expect(repo.findAll).toHaveBeenCalledWith({ search: "", sortField: "name", sortDirection: "asc" });
	});
});

describe("ListEpisodesUseCase", () => {
	it("resolves image urls for each program in range", async () => {
		const repo = fakeRepo();
		repo.findEpisodesInRange.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
		const imageStorage = { resolveImages: vi.fn((p) => ({ ...p, resolved: true })) };

		const result = await new ListEpisodesUseCase(
			asRepo(repo),
			imageStorage as unknown as ImageStorageRepository,
		).execute({ from: "2024-01-01", to: "2024-12-31" } as any, asLog(makeLog()));

		expect(repo.findEpisodesInRange).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
		expect(result).toEqual([
			{ id: "p1", resolved: true },
			{ id: "p2", resolved: true },
		]);
	});
});

describe("DeleteEpisodeUseCase", () => {
	it("forwards program and episode ids", () => {
		const repo = fakeRepo();
		new DeleteEpisodeUseCase(asRepo(repo)).execute({ programId: "p1", episodeId: "e1" } as any, asLog(makeLog()));
		expect(repo.deleteEpisode).toHaveBeenCalledWith("p1", "e1");
	});
});

describe("GetProgramUseCase", () => {
	it("strips _id, sorts episodes desc and attaches computed details", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({
			_id: "mongo",
			id: "p1",
			name: "Prog",
			episodes: [
				{ date: "2024-01-01", duration: 100 },
				{ date: "2024-03-01", duration: 100, durationReal: 50 },
			],
		});

		const result = await new GetProgramUseCase(asRepo(repo), passthroughImageStorage).execute(
			"p1",
			asLog(makeLog()),
		);

		expect(result?.episodes.map((e: any) => e.date)).toEqual(["2024-03-01", "2024-01-01"]);
		expect(result?.details).toEqual({
			episodes: 2,
			averageLength: 100,
			completionRate: 75,
			lastSeenDate: "2024-03-01",
		});
	});
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

describe("AntennaPod sync", () => {
	const listened = {
		episodeId: "guid-1",
		episodeTitle: "Episode 1",
		podcastTitle: "Prog",
		podcastUrl: "http://feed",
		listenedAtIso: "2026-10-01T20:00:00Z",
		duration: 3_600_000,
		playedDuration: 1_800_000,
		percentListened: 50,
	};

	function build() {
		const repo = {
			...fakeRepo(),
			findByRssUrl: vi.fn().mockResolvedValue({ id: "p1", name: "Prog" }),
			setRssRef: vi.fn(),
		};
		const syncRepo = {
			count: vi.fn().mockResolvedValue(0),
			insertMany: vi.fn(),
			findAllWithSource: vi.fn().mockResolvedValue([]),
			findByPodcastUrl: vi.fn().mockResolvedValue([]),
			findWithoutProposition: vi.fn().mockResolvedValue([]),
			deleteByPodcastUrl: vi.fn().mockResolvedValue({ deletedCount: 2 }),
			replace: vi.fn(),
		};
		const cache = { get: vi.fn().mockReturnValue(undefined), set: vi.fn() };
		const deps = [
			asRepo(repo),
			syncRepo as unknown as SyncRepository,
			cache as unknown as LatestEpisodesCacheRepository,
			passthroughImageStorage,
		] as const;
		return { repo, syncRepo, cache, deps };
	}

	it("upload stores one proposal per listened episode, with the raw source", async () => {
		const { syncRepo, deps } = build();
		extractMock.mockReturnValue([listened, { ...listened, episodeId: "guid-unknown" }]);
		fetchLatestMock.mockResolvedValue([
			{ id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" },
		] as never);

		expect(await new UploadAntennaPodUseCase(...deps).execute(new Uint8Array([1]), asLog(makeLog()))).toEqual({
			count: 2,
		});

		// Latest episodes fetched once for the program, then reused
		expect(fetchLatestMock).toHaveBeenCalledTimes(1);
		const [proposals] = syncRepo.insertMany.mock.calls[0];
		expect(proposals[0]).toMatchObject({
			listened,
			origin: { externalId: "guid-1", datetime: "2026-10-01T22:00:00" },
			proposition: { programId: "p1", name: "Episode 1", duration: 60, durationReal: 30, date: "2026-10-01" },
		});
		expect(proposals[1].proposition).toBeUndefined();
	});

	it("upload doesn't set programProfile for a program without profile", async () => {
		const { syncRepo, deps } = build();
		extractMock.mockReturnValue([listened]);
		fetchLatestMock.mockResolvedValue([
			{ id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" },
		] as never);

		await new UploadAntennaPodUseCase(...deps).execute(new Uint8Array([1]), asLog(makeLog()));

		const [proposals] = syncRepo.insertMany.mock.calls[0];
		expect(proposals[0].proposition).not.toHaveProperty("programProfile");
	});

	it("upload is refused while proposals already exist", async () => {
		const { syncRepo, deps } = build();
		syncRepo.count.mockResolvedValue(1);
		await expect(
			new UploadAntennaPodUseCase(...deps).execute(new Uint8Array([1]), asLog(makeLog())),
		).rejects.toThrow("Une synchronisation est déjà en cours");
		expect(extractMock).not.toHaveBeenCalled();
	});

	it("reprocess rebuilds each proposal from its source, ignoring the cache", async () => {
		const { syncRepo, cache, deps } = build();
		cache.get.mockReturnValue({ latestEpisodes: [] });
		syncRepo.findAllWithSource.mockResolvedValue([
			{ id: "s1", listened, origin: { program: "stale" }, proposition: { name: "stale" } },
		]);
		fetchLatestMock.mockResolvedValue([
			{ id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" },
		] as never);

		await new ReprocessSyncProposalsUseCase(...deps).execute(undefined, asLog(makeLog()));

		expect(cache.get).not.toHaveBeenCalled();
		expect(syncRepo.replace).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "s1",
				listened,
				proposition: expect.objectContaining({ name: "Episode 1" }),
			}),
		);
	});

	it("reprocess drops a stale proposition when the program no longer matches", async () => {
		const { repo, syncRepo, deps } = build();
		repo.findByRssUrl.mockResolvedValue(null);
		syncRepo.findAllWithSource.mockResolvedValue([{ id: "s1", listened, proposition: { name: "stale" } }]);

		await new ReprocessSyncProposalsUseCase(...deps).execute(undefined, asLog(makeLog()));

		expect(syncRepo.replace.mock.calls[0][0]).not.toHaveProperty("proposition");
	});

	it("flags a proposal whose episode is already saved in the program, without skipping it", async () => {
		const { repo, syncRepo, deps } = build();
		repo.findByRssUrl.mockResolvedValue({
			id: "p1",
			name: "Prog",
			episodes: [
				{ externalId: "guid-1", date: "2026-09-01" },
				{ externalId: "guid-1", date: "2026-09-15" },
				{ externalId: "other", date: "2026-09-20" },
			],
		});
		extractMock.mockReturnValue([listened]);
		fetchLatestMock.mockResolvedValue([
			{ id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" },
		] as never);

		await new UploadAntennaPodUseCase(...deps).execute(new Uint8Array([1]), asLog(makeLog()));

		const [proposals] = syncRepo.insertMany.mock.calls[0];
		expect(proposals[0]).toMatchObject({
			alreadySaved: { date: "2026-09-15" },
			proposition: { name: "Episode 1" },
		});
	});

	it("reprocess with a feed only rebuilds that feed's proposals", async () => {
		const { syncRepo, deps } = build();
		syncRepo.findByPodcastUrl.mockResolvedValue([{ id: "s1", listened }]);

		await new ReprocessSyncProposalsUseCase(...deps).execute("http://feed", asLog(makeLog()));

		expect(syncRepo.findByPodcastUrl).toHaveBeenCalledWith("http://feed");
		expect(syncRepo.findAllWithSource).not.toHaveBeenCalled();
		expect(syncRepo.replace).toHaveBeenCalledTimes(1);
	});

	it("lists the unknown feeds of the proposals without proposition", async () => {
		const { repo, syncRepo } = build();
		syncRepo.findWithoutProposition.mockResolvedValue([
			{ id: "s1", listened: { ...listened, podcastUrl: "http://unknown", podcastTitle: "Zeta" } },
			{ id: "s2", listened: { ...listened, podcastUrl: "http://unknown", podcastTitle: "Zeta" } },
			{ id: "s3", listened: { ...listened, podcastUrl: "http://untitled", podcastTitle: "" } },
			// known program, but episode not found in its feed: not an unknown feed
			{ id: "s4", listened },
		]);
		repo.findByRssUrl.mockImplementation(async (url: string) => (url === "http://feed" ? { id: "p1" } : null));

		const feeds = await new ListUnknownFeedsUseCase(asRepo(repo), syncRepo as unknown as SyncRepository).execute(
			asLog(makeLog()),
		);

		expect(feeds).toEqual([
			{ rssUrl: "http://untitled", title: "http://untitled", count: 1 },
			{ rssUrl: "http://unknown", title: "Zeta", count: 2 },
		]);
	});

	it("linking a feed replaces the program rss ref, then rebuilds that feed's proposals", async () => {
		const { repo, syncRepo, deps } = build();
		repo.findById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
		syncRepo.findByPodcastUrl.mockResolvedValue([{ id: "s1", listened }]);

		await new LinkFeedToProgramUseCase(asRepo(repo), new ReprocessSyncProposalsUseCase(...deps)).execute(
			{ rssUrl: "http://feed", programId: "11111111-1111-4111-8111-111111111111" },
			asLog(makeLog()),
		);

		expect(repo.setRssRef).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "http://feed");
		expect(syncRepo.findByPodcastUrl).toHaveBeenCalledWith("http://feed");
		expect(syncRepo.replace).toHaveBeenCalledTimes(1);
	});

	it("linking a feed to a missing program is refused", async () => {
		const { repo, deps } = build();
		await expect(
			new LinkFeedToProgramUseCase(asRepo(repo), new ReprocessSyncProposalsUseCase(...deps)).execute(
				{ rssUrl: "http://feed", programId: "11111111-1111-4111-8111-111111111111" },
				asLog(makeLog()),
			),
		).rejects.toThrow("Programme introuvable");
		expect(repo.setRssRef).not.toHaveBeenCalled();
	});

	it("ignoring a feed deletes its proposals", async () => {
		const { syncRepo } = build();
		expect(
			await new IgnoreFeedUseCase(syncRepo as unknown as SyncRepository).execute(
				{ rssUrl: "http://unknown" },
				asLog(makeLog()),
			),
		).toEqual({ count: 2 });
		expect(syncRepo.deleteByPodcastUrl).toHaveBeenCalledWith("http://unknown");
	});
});

describe("gopodder sync", () => {
	function build(since: number | undefined) {
		const repo = {
			...fakeRepo(),
			findByRssUrl: vi.fn().mockResolvedValue({ id: "p1", name: "Prog" }),
		};
		const syncRepo = { count: vi.fn().mockResolvedValue(0), insertMany: vi.fn() };
		const stateRepo = {
			getGopodderSince: vi.fn().mockResolvedValue(since),
			setGopodderSince: vi.fn(),
		};
		const cache = { get: vi.fn().mockReturnValue(undefined), set: vi.fn() };
		const useCase = new SyncGopodderUseCase(
			asRepo(repo),
			syncRepo as unknown as SyncRepository,
			stateRepo as unknown as SyncStateRepository,
			cache as unknown as LatestEpisodesCacheRepository,
			passthroughImageStorage,
		);
		return { syncRepo, stateRepo, useCase };
	}
	const play = {
		podcast: "http://feed",
		episode: "http://feed/ep1.mp3",
		guid: "guid-1",
		action: "play",
		timestamp: "2026-11-12T19:00:00",
		started: 0,
		position: 1800,
		total: 3600,
	};

	it("first sync only records the starting point (the initial upload holds the whole history)", async () => {
		const { syncRepo, stateRepo, useCase } = build(undefined);
		fetchActionsMock.mockResolvedValue({ actions: [play], timestamp: 1794500000 });

		expect(await useCase.execute(asLog(makeLog()))).toEqual({ count: 0, initialized: true });
		expect(stateRepo.setGopodderSince).toHaveBeenCalledWith(1794500000);
		expect(syncRepo.insertMany).not.toHaveBeenCalled();
	});

	it("next syncs build proposals from the new actions, then advance since", async () => {
		const { syncRepo, stateRepo, useCase } = build(1794400000);
		fetchActionsMock.mockResolvedValue({ actions: [play], timestamp: 1794500000 });
		fetchTitleMock.mockResolvedValue("Prog");
		fetchLatestMock.mockResolvedValue([
			{ id: "guid-1", title: "Episode 1", durationInMinutes: 60, link: "http://ep1" },
		] as never);

		expect(await useCase.execute(asLog(makeLog()))).toEqual({ count: 1 });

		expect(fetchActionsMock).toHaveBeenCalledWith(1794400000);
		const [proposals] = syncRepo.insertMany.mock.calls[0];
		expect(proposals[0]).toMatchObject({
			origin: { program: "Prog", episode: "Episode 1", datetime: "2026-11-12T20:00:00", listened: "30min" },
			proposition: { programId: "p1", name: "Episode 1", duration: 60, durationReal: 30, date: "2026-11-12" },
		});
		expect(stateRepo.setGopodderSince).toHaveBeenCalledWith(1794500000);
	});

	it("falls back to the feed url when the feed title can't be read", async () => {
		const { syncRepo, useCase } = build(1794400000);
		fetchActionsMock.mockResolvedValue({ actions: [play], timestamp: 1794500000 });
		fetchTitleMock.mockRejectedValue(new Error("down"));
		fetchLatestMock.mockRejectedValue(new Error("down"));

		await useCase.execute(asLog(makeLog()));

		const [proposals] = syncRepo.insertMany.mock.calls[0];
		expect(proposals[0].origin).toMatchObject({ program: "http://feed", episode: "" });
	});

	it("is refused while proposals already exist, without fetching gopodder", async () => {
		const { syncRepo, useCase } = build(1794400000);
		syncRepo.count.mockResolvedValue(3);

		await expect(useCase.execute(asLog(makeLog()))).rejects.toThrow("Une synchronisation est déjà en cours");
		expect(fetchActionsMock).not.toHaveBeenCalled();
	});
});

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

describe("ExtractInfoUseCase", () => {
	it("suggests programs whose links contain the france.tv program page", async () => {
		const programUrl = "https://www.france.tv/sport/cyclisme/championnats-du-monde-de-cyclisme-sur-piste/";
		const infos = { id: "8980837", title: "Poursuite (H)", author: { url: programUrl } };
		vi.mocked(getFranceTvVideoInfo).mockResolvedValue(infos as any);
		const suggested = [{ id: "p1", name: "Championnats du monde" }];
		const repo = { findChannelsByUrl: vi.fn().mockResolvedValue(suggested) };

		const result = await new ExtractInfoUseCase(repo as unknown as InternetRepository).execute(
			{ url: `${programUrl}8980837-poursuite-h-jonathan-milan-survole-la-finale.html` },
			asLog(makeLog()),
		);

		expect(repo.findChannelsByUrl).toHaveBeenCalledWith(programUrl);
		expect(result).toEqual({ ...infos, type: "video", suggestedPrograms: suggested });
	});
});
