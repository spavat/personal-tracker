import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fetch-latest", () => ({
	fetchLatestEpisodes: vi.fn().mockResolvedValue([]),
	getPodcastCoverImageUrl: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./extractor", () => ({
	getFranceTvVideoInfo: vi.fn(),
	getRawHTML: vi.fn(),
	getYoutubeChannelInfo: vi.fn(),
	getYoutubeVideoInfo: vi.fn(),
}));
vi.mock("./sync.entity", () => ({
	extractListenedEpisodesFromBuffer: vi.fn().mockReturnValue([]),
}));

import type { ImageStorageRepository } from "./image-storage.repository";
import type { InternetRepository } from "./internet.repository";
import type { LatestEpisodesCacheRepository } from "./latest-episodes-cache.repository";
import type { SyncRepository } from "./sync.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { getFranceTvVideoInfo } from "./extractor";
import { fetchLatestEpisodes } from "./fetch-latest";
import {
	DeleteEpisodeUseCase,
	ExtractInfoUseCase,
	GetLatestEpisodesForProgramUseCase,
	GetProgramUseCase,
	GetStatsUseCase,
	ListEpisodesUseCase,
	ListProgramsUseCase,
	ReprocessSyncProposalsUseCase,
	UploadAntennaPodUseCase,
} from "./internet.useCases";
import { extractListenedEpisodesFromBuffer } from "./sync.entity";

const fetchLatestMock = vi.mocked(fetchLatestEpisodes);
const extractMock = vi.mocked(extractListenedEpisodesFromBuffer);

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
});

describe("ListProgramsUseCase", () => {
	it("defaults the sort and normalises search", () => {
		const repo = fakeRepo();
		new ListProgramsUseCase(asRepo(repo)).execute({} as any, asLog(makeLog()));
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
		const repo = { ...fakeRepo(), findByRssUrl: vi.fn().mockResolvedValue({ id: "p1", name: "Prog" }) };
		const syncRepo = {
			count: vi.fn().mockResolvedValue(0),
			insertMany: vi.fn(),
			findAllWithSource: vi.fn().mockResolvedValue([]),
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

		await new ReprocessSyncProposalsUseCase(...deps).execute(asLog(makeLog()));

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

		await new ReprocessSyncProposalsUseCase(...deps).execute(asLog(makeLog()));

		expect(syncRepo.replace.mock.calls[0][0]).not.toHaveProperty("proposition");
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
