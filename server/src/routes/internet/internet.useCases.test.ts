import { describe, expect, it, vi } from "vitest";

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

import type { ImageStorageRepository } from "./image-storage.repository";
import type { InternetRepository } from "./internet.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { getFranceTvVideoInfo } from "./extractor";
import {
	DeleteEpisodeUseCase,
	ExtractInfoUseCase,
	GetProgramUseCase,
	ListEpisodesUseCase,
	ListProgramsUseCase,
} from "./internet.useCases";

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
