import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./video-info.client.js", () => ({
	getFranceTvVideoInfo: vi.fn(),
	getYoutubeChannelInfo: vi.fn(),
	getYoutubeVideoInfo: vi.fn(),
}));
vi.mock("./episode-feed.client.js", () => ({ getPodcastCoverImageUrl: vi.fn() }));

import { NotFoundError } from "../common/errors.js";
import { BroadcastImagesStorage } from "./broadcast-images.storage.js";
import { BroadcastRepository } from "./broadcast.repository.js";
import { BroadcastService } from "./broadcast.service.js";
import { getPodcastCoverImageUrl } from "./episode-feed.client.js";
import { getFranceTvVideoInfo, getYoutubeChannelInfo } from "./video-info.client.js";

const PROGRAM = "11111111-1111-4111-8111-111111111111";

describe("BroadcastService", () => {
	let service: BroadcastService;
	const repo = {
		findAll: vi.fn(),
		findEpisodesInRange: vi.fn(),
		findById: vi.fn(),
		findChannelsByUrl: vi.fn(),
		findProgramsWithYoutubeChannel: vi.fn(),
		findProgramsWithRssFeed: vi.fn(),
		insertProgram: vi.fn(),
		updateProgram: vi.fn(),
		pushEpisode: vi.fn(),
		updateEpisode: vi.fn(),
		deleteEpisode: vi.fn(),
	};
	const images = {
		isOwnUrl: (value: string) => value.startsWith("/images/broadcast/"),
		uploadFromSource: vi.fn(),
		resolveImages: (item: object) => item,
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		images.uploadFromSource.mockImplementation(
			async (id: string, _source: string, kind: string) => `key/${id}.${kind}`,
		);
		repo.findProgramsWithYoutubeChannel.mockResolvedValue([]);
		repo.findProgramsWithRssFeed.mockResolvedValue([]);
		const ref = await Test.createTestingModule({
			providers: [
				BroadcastService,
				{ provide: BroadcastRepository, useValue: repo },
				{ provide: BroadcastImagesStorage, useValue: images },
			],
		}).compile();
		service = ref.get(BroadcastService);
	});

	it("listPrograms defaults the sort and normalises the search", async () => {
		repo.findAll.mockResolvedValue([]);
		await service.listPrograms({} as never);
		expect(repo.findAll).toHaveBeenCalledWith({ search: "", sortField: "name", sortDirection: "asc" });
	});

	describe("getProgram", () => {
		it("sorts the episodes most recent first and adds the computed details", async () => {
			repo.findById.mockResolvedValue({
				_id: "mongo",
				id: "p1",
				name: "Prog",
				episodes: [
					{ date: "2024-01-01", duration: 100 },
					{ date: "2024-03-01", duration: 100, durationReal: 50 },
				],
			});

			const result = await service.getProgram("p1");

			expect(result).not.toHaveProperty("_id");
			expect(result.episodes.map((e) => e.date)).toEqual(["2024-03-01", "2024-01-01"]);
			expect(result.details).toEqual({
				episodes: 2,
				averageLength: 100,
				completionRate: 75,
				lastSeenDate: "2024-03-01",
			});
		});

		it("rejects with NotFoundError for an unknown (or private, for a visitor) program", async () => {
			repo.findById.mockResolvedValue(null);
			await expect(service.getProgram("p1")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	it("extract suggests the programs whose links hold the france.tv program page", async () => {
		const programUrl = "https://www.france.tv/sport/cyclisme/championnats-du-monde-de-cyclisme-sur-piste/";
		const infos = { id: "8980837", title: "Poursuite (H)", author: { url: programUrl } };
		vi.mocked(getFranceTvVideoInfo).mockResolvedValue(infos as never);
		const suggested = [{ id: "p1", name: "Championnats du monde" }];
		repo.findChannelsByUrl.mockResolvedValue(suggested);

		const result = await service.extract({ url: `${programUrl}8980837-poursuite.html` });

		expect(repo.findChannelsByUrl).toHaveBeenCalledWith(programUrl);
		expect(result).toEqual({ ...infos, type: "video", suggestedPrograms: suggested });
	});

	it("extract answers {} when the page can't be read", async () => {
		vi.mocked(getFranceTvVideoInfo).mockRejectedValue(new Error("down"));
		expect(await service.extract({ url: "https://www.france.tv/x/1-y.html" })).toEqual({});
	});

	describe("programs and episodes", () => {
		it("adds an episode with a generated id, without its empty tag lists", async () => {
			repo.pushEpisode.mockResolvedValue(true);
			await service.createEpisode(PROGRAM, {
				name: "Ep",
				duration: 30,
				date: "2026-10-01",
				type: "podcast",
				tags: [],
				contextTags: [],
			} as never);

			const [programId, episode] = repo.pushEpisode.mock.calls[0];
			expect(programId).toBe(PROGRAM);
			expect(episode).toMatchObject({ id: expect.any(String), name: "Ep", created: expect.any(String) });
			expect(episode).not.toHaveProperty("tags");
		});

		it("updates the episode of the path and answers the stored one", async () => {
			repo.updateEpisode.mockResolvedValue(true);
			repo.findById.mockResolvedValue({ id: PROGRAM, episodes: [{ id: "e1", name: "Ep" }] });
			expect(await service.updateEpisode(PROGRAM, "e1", { name: "Ep" } as never)).toEqual({
				id: "e1",
				name: "Ep",
			});
			expect(repo.updateEpisode).toHaveBeenCalledWith(PROGRAM, expect.objectContaining({ id: "e1" }));
		});

		it("stores the images of a new program given as outside URLs", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, name: "Prog", episodes: [] });
			await service.createProgram({ program: { name: "Prog", profile: "https://cdn/p.jpg" } } as never);

			const inserted = repo.insertProgram.mock.calls[0][0];
			expect(images.uploadFromSource).toHaveBeenCalledWith(inserted.id, "https://cdn/p.jpg", "profile");
			expect(inserted).toMatchObject({ name: "Prog", profile: `key/${inserted.id}.profile`, episodes: [] });
		});

		it("keeps the stored image of a program sent back with its proxy URL", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, profile: "stored/key.avif" });
			repo.updateProgram.mockResolvedValue({ id: PROGRAM });

			await service.updateProgram(PROGRAM, {
				program: { name: "Prog", profile: `/images/broadcast/${PROGRAM}.profile` },
			} as never);

			expect(images.uploadFromSource).not.toHaveBeenCalled();
			expect(repo.updateProgram).toHaveBeenCalledWith(PROGRAM, {
				name: "Prog",
				profile: "stored/key.avif",
			});
		});

		it("fetches the cover of a new podcast without images from its feed", async () => {
			vi.mocked(getPodcastCoverImageUrl).mockResolvedValue("https://feed/cover.jpg");

			repo.findById.mockResolvedValue({ id: PROGRAM, name: "Prog", episodes: [] });
			await service.createProgram({ program: { name: "Prog", refs: { rss: "https://feed" } } } as never);

			expect(repo.insertProgram.mock.calls[0][0].profile).toMatch(/\.profile$/);
			expect(images.uploadFromSource).toHaveBeenCalledWith(
				expect.any(String),
				"https://feed/cover.jpg",
				"profile",
			);
		});
	});

	it("syncCovers only uploads the images a channel is missing, and reports the failures", async () => {
		repo.findProgramsWithYoutubeChannel.mockResolvedValue([
			{ id: "p1", name: "Has profile", profile: "k", refs: { youtubeChannelId: "UC1" } },
			{ id: "p2", name: "Down", refs: { youtubeChannelId: "UC2" } },
		]);
		vi.mocked(getYoutubeChannelInfo)
			.mockResolvedValueOnce({ profile: { url: "https://p" }, banner: { url: "https://b" } })
			.mockRejectedValueOnce(new Error("blocked"));

		const result = await service.syncCovers();

		expect(images.uploadFromSource).toHaveBeenCalledTimes(1);
		expect(images.uploadFromSource).toHaveBeenCalledWith("p1", "https://b", "banner");
		expect(repo.updateProgram).toHaveBeenCalledWith("p1", { banner: "key/p1.banner" });
		expect(result).toEqual({
			successes: [{ id: "p1", name: "Has profile" }],
			errors: [{ id: "p2", name: "Down", error: "blocked" }],
		});
	});
});
