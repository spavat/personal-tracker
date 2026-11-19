import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../common/errors.js";
import { GenresRepository } from "./genres.repository.js";
import { GenresService } from "./genres.service.js";
import { MusicStatsService } from "./music-stats.service.js";
import { MusicRepository } from "./music.repository.js";
import { MusicService } from "./music.service.js";

const musicRepo = {
	findAll: vi.fn(),
	searchListenings: vi.fn(),
	findById: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};
const genresRepo = {
	findAll: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
};

let music: MusicService;
let stats: MusicStatsService;
let genres: GenresService;

beforeEach(async () => {
	vi.resetAllMocks();
	musicRepo.findAll.mockResolvedValue([]);
	genresRepo.findAll.mockResolvedValue([]);
	const ref = await Test.createTestingModule({
		providers: [
			MusicService,
			MusicStatsService,
			GenresService,
			{ provide: MusicRepository, useValue: musicRepo },
			{ provide: GenresRepository, useValue: genresRepo },
		],
	}).compile();
	music = ref.get(MusicService);
	stats = ref.get(MusicStatsService);
	genres = ref.get(GenresService);
});

describe("GenresService", () => {
	it("list delegates to findAll", () => {
		genres.list();
		expect(genresRepo.findAll).toHaveBeenCalled();
	});
	it("create inserts a built genre", () => {
		genres.create({ name: "Rock", genres: ["prog"] });
		expect(genresRepo.insert.mock.calls[0][0]).toMatchObject({ name: "Rock", genres: ["prog"] });
		expect(genresRepo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
	});
	it("update updates an existing genre", async () => {
		genresRepo.update.mockResolvedValue({ id: "g1" });
		await genres.update("g1", { name: "Metal", genres: [] });
		expect(genresRepo.update).toHaveBeenCalledWith("g1", { name: "Metal", genres: [] });
		expect(genresRepo.insert).not.toHaveBeenCalled();
	});
	it("delete forwards the id", () => {
		genresRepo.delete.mockResolvedValue(true);
		genres.delete("g1");
		expect(genresRepo.delete).toHaveBeenCalledWith("g1");
	});
});

describe("MusicService", () => {
	it("list / search delegate to the repository", () => {
		music.list({ from: "2024-01-01", to: "2024-12-31" });
		music.search("rush");
		expect(musicRepo.findAll).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
		expect(musicRepo.searchListenings).toHaveBeenCalledWith("rush");
	});

	it("get rejects with NotFoundError for an unknown listening", async () => {
		musicRepo.findById.mockResolvedValue(null);
		await expect(music.get("l1")).rejects.toBeInstanceOf(NotFoundError);
		expect(musicRepo.findById).toHaveBeenCalledWith("l1");
	});

	it("update drops empty context tags", async () => {
		musicRepo.update.mockResolvedValue({ id: "l1" });
		await music.update("l1", { album: "X", contextTags: [] } as never);
		expect(musicRepo.update).toHaveBeenCalledWith("l1", { album: "X" });
		expect(musicRepo.insert).not.toHaveBeenCalled();
	});

	it("create inserts a new listening with id and created", () => {
		music.create({ album: "X" } as never);
		const inserted = musicRepo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ album: "X" });
		expect(inserted.id).toEqual(expect.any(String));
		expect(inserted.created).toEqual(expect.any(String));
	});

	it("delete forwards the id", () => {
		musicRepo.delete.mockResolvedValue(true);
		music.delete("l1");
		expect(musicRepo.delete).toHaveBeenCalledWith("l1");
	});
});

describe("MusicStatsService.report", () => {
	const from = "2020-01-01";
	const to = "2020-01-05"; // entirely in the past -> periodDaysCount is deterministic (5)

	it("returns an empty report when there are no listenings", async () => {
		expect(await stats.report({ from, to })).toEqual({
			hasData: false,
			stats: {
				averageDurationByDay: 0,
				totalDuration: 0,
				artistsCount: 0,
				albumsCount: 0,
				uniqueDaysCount: 0,
				periodDaysCount: 5,
			},
			artists: [],
			genres: [],
		});
	});

	it("aggregates duration by artist and by mapped genre", async () => {
		musicRepo.findAll.mockResolvedValue([
			{ listeningDate: "2020-01-02", duration: 30, genre: "prog rock", artist: ["Rush"], compilation: false },
			{ listeningDate: "2020-01-03", duration: 20, genre: "metal", artist: ["Rush", "Tool"], compilation: false },
		]);
		genresRepo.findAll.mockResolvedValue([{ name: "Rock", genres: ["prog rock", "metal"] }]);

		expect(await stats.report({ from, to })).toEqual({
			hasData: true,
			stats: {
				averageDurationByDay: 10,
				totalDuration: 50,
				artistsCount: 2,
				albumsCount: 2,
				uniqueDaysCount: 2,
				periodDaysCount: 5,
			},
			artists: [
				{ name: "Rush", duration: 50 },
				{ name: "Tool", duration: 20 },
			],
			genres: [
				{
					name: "Rock",
					duration: 50,
					artists: [
						{ name: "Rush", duration: 50 },
						{ name: "Tool", duration: 20 },
					],
				},
			],
		});
	});
});

describe("MusicStatsService.stats", () => {
	it("groups by month, main genre and release year", async () => {
		musicRepo.findAll.mockResolvedValue([
			{ listeningDate: "2020-01-02", duration: 30, genre: "prog rock", artist: ["Rush"], releaseDate: "1981" },
			{ listeningDate: "2020-02-03", duration: 20, genre: "bebop", artist: ["Monk"], releaseDate: "" },
		]);
		genresRepo.findAll.mockResolvedValue([{ name: "Rock", genres: ["prog rock"] }]);

		const result = await stats.stats({ from: "2020-01-01", to: "2020-02-29" });

		expect(result.monthsDistribution.map(({ key, duration }) => [key, duration])).toEqual([
			["2020-01", 30],
			["2020-02", 20],
		]);
		expect(result.genresDistribution.map(({ name, duration }) => [name, duration])).toEqual([
			["Rock", 30],
			["bebop", 20], // not grouped: kept as is
		]);
		expect(result.releaseYearsDistribution.map(({ key }) => key)).toEqual(["1981", "XXXX"]);
		expect(result).toMatchObject({ totalDuration: 50, nbListenings: 2, nbDays: 60, inProgress: false });
	});
});
