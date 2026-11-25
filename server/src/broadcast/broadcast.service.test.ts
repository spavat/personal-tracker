import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./sources/video-info.client.js", () => ({
	getFranceTvVideoInfo: vi.fn(),
	getYoutubeChannelInfo: vi.fn(),
	getYoutubeVideoInfo: vi.fn(),
}));
vi.mock("./sources/episode-feed.client.js", () => ({
	getPodcastCoverImageUrl: vi.fn(),
	fetchCatalogEpisodes: vi.fn(),
}));

import { BadRequestError, ConflictError, NotFoundError, UpstreamError } from "../common/errors.js";
import { BroadcastImagesStorage } from "./broadcast-images.storage.js";
import { BroadcastRepository } from "./broadcast.repository.js";
import { BroadcastService } from "./broadcast.service.js";
import { fetchCatalogEpisodes, getPodcastCoverImageUrl } from "./sources/episode-feed.client.js";
import { getFranceTvVideoInfo, getYoutubeChannelInfo } from "./sources/video-info.client.js";
import { YoutubeDataClient } from "./sources/youtube-data.client.js";

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
		findEpisode: vi.fn(),
		countEntities: vi.fn(),
		findSeasons: vi.fn(),
		findFormats: vi.fn(),
		findEpisodeIdByExternalId: vi.fn(),
		createEpisode: vi.fn(),
		updateEpisode: vi.fn(),
		deleteEpisode: vi.fn(),
		createView: vi.fn(),
		updateView: vi.fn(),
		deleteView: vi.fn(),
		importEpisodes: vi.fn(),
		setEpisodeStatus: vi.fn(),
		findEpisodeCover: vi.fn(),
		setEpisodeCovers: vi.fn(),
	};
	const images = {
		isOwnUrl: (value: string) => value.startsWith("/images/broadcast/"),
		uploadFromSource: vi.fn(),
		resolveImages: (item: object) => item,
		isOwnEpisodeCoverUrl: (value: string) => value.startsWith("/images/broadcast/episode/"),
		readEpisodeCover: vi.fn(),
		storeEpisodeCover: vi.fn(),
		deleteObject: vi.fn(),
	};
	let storedCovers = 0;
	const youtube = { fetchPlaylistVideos: vi.fn(), fetchVideos: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		repo.findSeasons.mockResolvedValue([]);
		repo.findFormats.mockResolvedValue([]);
		images.uploadFromSource.mockImplementation(
			async (id: string, _source: string, kind: string) => `key/${id}.${kind}`,
		);
		repo.findProgramsWithYoutubeChannel.mockResolvedValue([]);
		repo.findProgramsWithRssFeed.mockResolvedValue([]);
		storedCovers = 0;
		images.readEpisodeCover.mockImplementation(async (source: string) => Buffer.from(source));
		images.storeEpisodeCover.mockImplementation(async () => `cover-${++storedCovers}`);
		const ref = await Test.createTestingModule({
			providers: [
				BroadcastService,
				{ provide: BroadcastRepository, useValue: repo },
				{ provide: BroadcastImagesStorage, useValue: images },
				{ provide: YoutubeDataClient, useValue: youtube },
			],
		}).compile();
		service = ref.get(BroadcastService);
	});

	it("listPrograms defaults the sort and normalises the search", async () => {
		repo.findAll.mockResolvedValue([]);
		await service.listPrograms({} as never);
		expect(repo.findAll).toHaveBeenCalledWith({ search: "", sortField: "name", sortDirection: "asc" });
	});

	describe("importCatalog", () => {
		const FORMAT = { id: "f1", position: 1, label: "Bonus", match: "bonus" };

		it("upserts the releases of the program's RSS feed with its formats", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, refs: { rss: "https://feed" }, episodes: [] });
			repo.findFormats.mockResolvedValue([FORMAT]);
			const items = [{ externalId: "g1", name: "Ep 1", duration: 30 }];
			vi.mocked(fetchCatalogEpisodes).mockResolvedValue(items);
			repo.importEpisodes.mockResolvedValue({ created: 1, updated: 0, covers: [] });

			expect(await service.importCatalog(PROGRAM, { source: "rss" })).toEqual({ created: 1, updated: 0 });
			expect(fetchCatalogEpisodes).toHaveBeenCalledWith("https://feed");
			expect(repo.importEpisodes).toHaveBeenCalledWith(PROGRAM, items, "podcast", [FORMAT]);
		});

		it("imports the uploads of the YouTube channel (without shorts) or the playlist, without its shorts", async () => {
			repo.findById.mockResolvedValue({
				id: PROGRAM,
				refs: { youtubeChannelId: "UCabc", youtubePlaylistId: "PL1" },
				episodes: [],
			});
			const items = [{ externalId: "v1", name: "Video", duration: 12 }];
			youtube.fetchPlaylistVideos.mockResolvedValue(items);
			repo.importEpisodes.mockResolvedValue({ created: 1, updated: 0, covers: [] });

			await service.importCatalog(PROGRAM, { source: "youtubeChannelId" });
			await service.importCatalog(PROGRAM, { source: "youtubePlaylistId" });

			expect(youtube.fetchPlaylistVideos.mock.calls).toEqual([
				["UULFabc", { skipShorts: false }],
				["PL1", { skipShorts: true }],
			]);
			expect(repo.importEpisodes).toHaveBeenCalledWith(PROGRAM, items, "video", []);
			expect(fetchCatalogEpisodes).not.toHaveBeenCalled();
		});

		it("completes a feed with its stored videos only, asked by the id of their YouTube link", async () => {
			repo.findById.mockResolvedValue({
				id: PROGRAM,
				tracking: "feed",
				refs: { youtubeChannelId: "UCabc" },
				episodes: [
					{ link: "https://www.youtube.com/watch?v=aaaaaaaaaaa" },
					{ link: "https://youtu.be/bbbbbbbbbbb" },
					{ link: "https://www.youtube.com/watch?v=aaaaaaaaaaa&t=1" },
					{ link: "https://www.radiofrance.fr/episode" },
					{},
				],
			});
			const items = [{ externalId: "aaaaaaaaaaa", name: "Video", duration: 12 }];
			youtube.fetchVideos.mockResolvedValue(items);
			repo.importEpisodes.mockResolvedValue({ created: 0, updated: 1, covers: [] });

			expect(await service.importCatalog(PROGRAM, { source: "youtubeChannelId" })).toEqual({
				created: 0,
				updated: 1,
			});
			expect(youtube.fetchVideos).toHaveBeenCalledWith(["aaaaaaaaaaa", "bbbbbbbbbbb"]);
			expect(youtube.fetchPlaylistVideos).not.toHaveBeenCalled();
			expect(repo.importEpisodes).toHaveBeenCalledWith(PROGRAM, items, "video", []);
		});

		it("refuses a source the program doesn't have", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, refs: { youtubeChannelId: "UC1" }, episodes: [] });

			await expect(service.importCatalog(PROGRAM, { source: "rss" })).rejects.toMatchObject({
				code: "broadcast.no_feed",
			});
			expect(repo.importEpisodes).not.toHaveBeenCalled();
		});

		it("answers an upstream error when the feed can't be read", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, refs: { rss: "https://feed" }, episodes: [] });
			vi.mocked(fetchCatalogEpisodes).mockRejectedValue(new Error("timeout"));

			await expect(service.importCatalog(PROGRAM, { source: "rss" })).rejects.toBeInstanceOf(UpstreamError);
		});

		it("answers 404 for an unknown program", async () => {
			repo.findById.mockResolvedValue(null);

			await expect(service.importCatalog(PROGRAM, { source: "rss" })).rejects.toBeInstanceOf(NotFoundError);
		});

		it("downloads each cover once, stores it for each of its episodes, skips an unreadable one", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, refs: { rss: "https://feed" }, episodes: [] });
			vi.mocked(fetchCatalogEpisodes).mockResolvedValue([]);
			repo.importEpisodes.mockResolvedValue({
				created: 3,
				updated: 0,
				covers: [
					{ episodeId: "e1", source: "https://img/shared.jpg" },
					{ episodeId: "e2", source: "https://img/shared.jpg" },
					{ episodeId: "e3", source: "https://img/broken.jpg" },
				],
			});
			images.readEpisodeCover.mockImplementation(async (source: string) => {
				if (source.includes("broken")) throw new Error("404");
				return Buffer.from(source);
			});

			expect(await service.importCatalog(PROGRAM, { source: "rss" })).toEqual({ created: 3, updated: 0 });
			expect(images.readEpisodeCover).toHaveBeenCalledTimes(2);
			expect(repo.setEpisodeCovers).toHaveBeenCalledWith([
				{ episodeId: "e1", coverKey: "cover-1" },
				{ episodeId: "e2", coverKey: "cover-2" },
			]);
		});
	});

	describe("getProgram", () => {
		it("sorts the episodes and their views watched last first and adds the computed details", async () => {
			repo.findById.mockResolvedValue({
				id: "p1",
				name: "Prog",
				episodes: [
					{ id: "e1", duration: 100, views: [{ id: "v1", date: "2024-01-01" }] },
					{
						id: "e2",
						duration: 100,
						views: [
							{ id: "v2", date: "2023-12-01" },
							{ id: "v3", date: "2024-03-01", duration: 50 },
						],
					},
				],
			});

			const result = await service.getProgram("p1");

			expect(result.episodes.map((e) => [e.id, e.views.map(({ id }) => id)])).toEqual([
				["e2", ["v3", "v2"]],
				["e1", ["v1"]],
			]);
			expect(result.details).toEqual({
				episodes: 3,
				averageLength: 100,
				completionRate: 83,
				lastSeenDate: "2024-03-01",
				releases: 2,
				watched: 2,
				skipped: 0,
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
		it("creates the episode with its first view, and answers it", async () => {
			repo.createEpisode.mockResolvedValue({ episodeId: "e1", replacedCoverKey: null });
			repo.findEpisode.mockResolvedValue({ id: "e1", name: "Ep", views: [] });
			const view = { date: "2026-10-01", contextTags: [] };

			expect(
				await service.createEpisode(PROGRAM, {
					name: "Ep",
					duration: 30,
					type: "podcast",
					credits: [],
					view,
				} as never),
			).toEqual({ id: "e1", name: "Ep", views: [] });
			expect(repo.createEpisode).toHaveBeenCalledWith(
				PROGRAM,
				{ name: "Ep", duration: 30, type: "podcast", credits: [] },
				view,
			);
		});

		it("refuses a credit to an unknown entity, before saving", async () => {
			repo.countEntities.mockResolvedValue(0);
			await expect(
				service.updateEpisode(PROGRAM, "e1", {
					name: "Ep",
					credits: [{ entityId: "x", role: "guest", creditedAs: null }],
				} as never),
			).rejects.toBeInstanceOf(BadRequestError);
			expect(repo.updateEpisode).not.toHaveBeenCalled();
		});

		it("refuses a season or a format of another program", async () => {
			repo.findSeasons.mockResolvedValue([{ id: "s1", position: 1, label: "Saison 1" }]);
			await expect(
				service.updateEpisode(PROGRAM, "e1", { name: "Ep", seasonId: "other", credits: [] } as never),
			).rejects.toBeInstanceOf(BadRequestError);
			repo.findById.mockResolvedValue({ id: PROGRAM, episodes: [] });
			await expect(
				service.saveSeasons(PROGRAM, { seasons: [{ id: "other", label: "Saison 2" }] }),
			).rejects.toBeInstanceOf(BadRequestError);
			expect(repo.updateEpisode).not.toHaveBeenCalled();
		});

		it("refuses a format label given twice, case ignored", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, episodes: [] });
			await expect(
				service.saveFormats(PROGRAM, {
					formats: [
						{ label: "Vlog", match: null },
						{ label: "vlog", match: null },
					],
				}),
			).rejects.toBeInstanceOf(BadRequestError);
		});

		it("puts an episode on the watchlist: planned, without view", async () => {
			repo.createEpisode.mockResolvedValue({ episodeId: "e1", replacedCoverKey: null });
			repo.findEpisode.mockResolvedValue({ id: "e1", name: "Ep", status: "planned", views: [] });

			await service.createEpisode(PROGRAM, { name: "Ep", credits: [], status: "planned" } as never);

			expect(repo.createEpisode).toHaveBeenCalledWith(PROGRAM, { name: "Ep", credits: [] }, "planned");
		});

		it("sets or clears a status; the covers of an episode it deletes go, an unknown episode is a 404", async () => {
			repo.setEpisodeStatus.mockResolvedValueOnce([]).mockResolvedValueOnce(["k1"]).mockResolvedValueOnce(null);

			await service.setEpisodeStatus(PROGRAM, "e1", { status: "skipped" });
			await service.setEpisodeStatus(PROGRAM, "e1", { status: null });
			await expect(service.setEpisodeStatus(PROGRAM, "e1", { status: null })).rejects.toBeInstanceOf(
				NotFoundError,
			);

			expect(repo.setEpisodeStatus.mock.calls).toEqual([
				[PROGRAM, "e1", "skipped"],
				[PROGRAM, "e1", null],
				[PROGRAM, "e1", null],
			]);
			expect(images.deleteObject.mock.calls).toEqual([["k1"]]);
		});

		it("answers 404 to an episode of an unknown program", async () => {
			repo.createEpisode.mockResolvedValue(undefined);
			await expect(
				service.createEpisode(PROGRAM, { name: "Ep", credits: [], view: { date: "2026-10-01" } } as never),
			).rejects.toBeInstanceOf(NotFoundError);
		});

		it("updates the episode of the path and answers the stored one", async () => {
			repo.findEpisodeCover.mockResolvedValue({ coverKey: null });
			repo.updateEpisode.mockResolvedValue(true);
			repo.findEpisode.mockResolvedValue({ id: "e1", name: "Ep", views: [] });
			expect(await service.updateEpisode(PROGRAM, "e1", { name: "Ep", credits: [] } as never)).toEqual({
				id: "e1",
				name: "Ep",
				views: [],
			});
			expect(repo.updateEpisode).toHaveBeenCalledWith(PROGRAM, "e1", { name: "Ep", credits: [], coverKey: null });
		});

		it("refuses the externalId of another episode of the program", async () => {
			repo.findEpisodeIdByExternalId.mockResolvedValue("e2");
			await expect(
				service.updateEpisode(PROGRAM, "e1", { name: "Ep", externalId: "guid", credits: [] } as never),
			).rejects.toBeInstanceOf(ConflictError);
			expect(repo.findEpisodeIdByExternalId).toHaveBeenCalledWith(PROGRAM, "guid", "e1");
			expect(repo.updateEpisode).not.toHaveBeenCalled();
		});

		it("answers the view saved on the episode", async () => {
			repo.updateView.mockResolvedValue(true);
			repo.findEpisode.mockResolvedValue({ id: "e1", views: [{ id: "v1", date: "2026-10-02" }] });
			expect(await service.updateView(PROGRAM, "e1", "v1", { date: "2026-10-02" })).toEqual({
				id: "v1",
				date: "2026-10-02",
			});
			expect(repo.updateView).toHaveBeenCalledWith(PROGRAM, "e1", "v1", { date: "2026-10-02" });
		});

		it("answers 404 to an unknown view", async () => {
			repo.deleteView.mockResolvedValue(null);
			await expect(service.deleteView(PROGRAM, "e1", "v1")).rejects.toBeInstanceOf(NotFoundError);
		});

		describe("episode covers", () => {
			const STORED = `/images/broadcast/episode/e1?v=old`;
			beforeEach(() => {
				repo.findEpisode.mockResolvedValue({ id: "e1", name: "Ep", views: [] });
				repo.updateEpisode.mockResolvedValue(true);
				repo.findEpisodeCover.mockResolvedValue({ coverKey: "old" });
			});
			const update = (cover?: string) =>
				service.updateEpisode(PROGRAM, "e1", { name: "Ep", credits: [], cover } as never);

			it("stores a new episode's cover given as an outside URL, and removes the one it replaced", async () => {
				repo.createEpisode.mockResolvedValue({ episodeId: "e1", replacedCoverKey: "old" });

				await service.createEpisode(PROGRAM, {
					name: "Ep",
					credits: [],
					cover: "https://img/e1.jpg",
					view: { date: "2026-10-01" },
				} as never);

				expect(images.readEpisodeCover).toHaveBeenCalledWith("https://img/e1.jpg");
				expect(repo.createEpisode.mock.calls[0][1]).toEqual({ name: "Ep", credits: [], coverKey: "cover-1" });
				expect(images.deleteObject).toHaveBeenCalledWith("old");
			});

			it("keeps the cover of a stored episode getting a view without one", async () => {
				repo.createEpisode.mockResolvedValue({ episodeId: "e1", replacedCoverKey: null });

				await service.createEpisode(PROGRAM, {
					name: "Ep",
					credits: [],
					view: { date: "2026-10-01" },
				} as never);

				expect(repo.createEpisode.mock.calls[0][1]).toEqual({ name: "Ep", credits: [] });
				expect(images.deleteObject).not.toHaveBeenCalled();
			});

			it("refuses an unreadable cover before saving", async () => {
				images.readEpisodeCover.mockRejectedValue(new Error("not an image"));

				await expect(
					service.createEpisode(PROGRAM, {
						name: "Ep",
						credits: [],
						cover: "https://img/page.html",
						view: { date: "2026-10-01" },
					} as never),
				).rejects.toMatchObject({ code: "invalid_image", params: { resource: "cover" } });
				expect(repo.createEpisode).not.toHaveBeenCalled();
			});

			it("keeps the stored cover sent back with its proxy URL", async () => {
				await update(STORED);

				expect(images.readEpisodeCover).not.toHaveBeenCalled();
				expect(repo.updateEpisode.mock.calls[0][2]).toMatchObject({ coverKey: "old" });
				expect(images.deleteObject).not.toHaveBeenCalled();
			});

			it("replaces the cover with another source, and removes the former one", async () => {
				await update("data:image/png;base64,AAAA");

				expect(repo.updateEpisode.mock.calls[0][2]).toMatchObject({ coverKey: "cover-1" });
				expect(images.deleteObject).toHaveBeenCalledWith("old");
			});

			it("removes the cover left out", async () => {
				await update(undefined);

				expect(repo.updateEpisode.mock.calls[0][2]).toMatchObject({ coverKey: null });
				expect(images.deleteObject).toHaveBeenCalledWith("old");
			});

			it("removes the new cover of an episode not saved", async () => {
				repo.updateEpisode.mockResolvedValue(false);

				await expect(update("https://img/new.jpg")).rejects.toBeInstanceOf(NotFoundError);
				expect(images.deleteObject).toHaveBeenCalledWith("cover-1");
				expect(images.deleteObject).not.toHaveBeenCalledWith("old");
			});

			it("removes the covers of the episodes deleted", async () => {
				repo.deleteEpisode.mockResolvedValue("k1");
				await service.deleteEpisode(PROGRAM, "e1");
				repo.deleteView.mockResolvedValue(["k2"]);
				await service.deleteView(PROGRAM, "e1", "v1");
				repo.findById.mockResolvedValue({ id: PROGRAM, episodes: [] });
				repo.updateProgram.mockResolvedValue(["k3", "k4"]);
				await service.updateProgram(PROGRAM, { program: { name: "Prog", tracking: "feed" } } as never);

				expect(images.deleteObject.mock.calls.map(([key]) => key)).toEqual(["k1", "k2", "k3", "k4"]);
			});

			it("answers 404 for an unknown episode to delete", async () => {
				repo.deleteEpisode.mockResolvedValue(undefined);
				await expect(service.deleteEpisode(PROGRAM, "e1")).rejects.toBeInstanceOf(NotFoundError);
			});
		});

		it("stores the images of a new program given as outside URLs", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, name: "Prog", episodes: [] });
			await service.createProgram({ program: { name: "Prog", profile: "https://cdn/p.jpg" } } as never);

			const inserted = repo.insertProgram.mock.calls[0][0];
			expect(images.uploadFromSource).toHaveBeenCalledWith(inserted.id, "https://cdn/p.jpg", "profile");
			expect(inserted).toMatchObject({ name: "Prog", profile: `key/${inserted.id}.profile` });
		});

		it("keeps the stored image of a program sent back with its proxy URL", async () => {
			repo.findById.mockResolvedValue({ id: PROGRAM, profile: "stored/key.avif", episodes: [] });
			repo.updateProgram.mockResolvedValue([]);

			await service.updateProgram(PROGRAM, {
				program: { name: "Prog", profile: `/images/broadcast/${PROGRAM}.profile` },
			} as never);

			expect(images.uploadFromSource).not.toHaveBeenCalled();
			// no credits given: kept
			expect(repo.updateProgram).toHaveBeenCalledWith(
				PROGRAM,
				{ name: "Prog", profile: "stored/key.avif" },
				undefined,
			);
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
