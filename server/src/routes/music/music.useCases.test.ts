import { describe, expect, it, vi } from "vitest";

import type { GenreRepository } from "./genre.repository";
import type { MusicRepository } from "./music.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { CreateGenreUseCase, DeleteGenreUseCase, ListGenresUseCase, UpdateGenreUseCase } from "./genre.useCases";
import {
	DeleteListeningUseCase,
	GetListeningUseCase,
	GetReportUseCase,
	ListListeningsUseCase,
	SaveListeningUseCase,
	SearchListeningsUseCase,
} from "./music.useCases";

function fakeMusicRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		searchListenings: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}
function fakeGenreRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}
const asMusic = (r: ReturnType<typeof fakeMusicRepo>) => r as unknown as MusicRepository;
const asGenre = (r: ReturnType<typeof fakeGenreRepo>) => r as unknown as GenreRepository;

describe("genre use cases", () => {
	it("list delegates to findAll", () => {
		const repo = fakeGenreRepo();
		new ListGenresUseCase(asGenre(repo)).execute(asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalled();
	});
	it("create inserts a built genre", () => {
		const repo = fakeGenreRepo();
		new CreateGenreUseCase(asGenre(repo)).execute({ name: "Rock", genres: ["prog"] }, asLog(makeLog()));
		expect(repo.insert.mock.calls[0][0]).toMatchObject({ name: "Rock", genres: ["prog"] });
		expect(repo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
	});
	it("update forwards id and patch", () => {
		const repo = fakeGenreRepo();
		new UpdateGenreUseCase(asGenre(repo)).execute({ id: "g1", input: { name: "Metal" } }, asLog(makeLog()));
		expect(repo.update).toHaveBeenCalledWith("g1", { name: "Metal" });
	});
	it("delete forwards the id", () => {
		const repo = fakeGenreRepo();
		new DeleteGenreUseCase(asGenre(repo)).execute("g1", asLog(makeLog()));
		expect(repo.delete).toHaveBeenCalledWith("g1");
	});
});

describe("listening use cases", () => {
	it("list / search / get delegate to the repository", () => {
		const repo = fakeMusicRepo();
		new ListListeningsUseCase(asMusic(repo)).execute({ from: "2024-01-01", to: "2024-12-31" }, asLog(makeLog()));
		new SearchListeningsUseCase(asMusic(repo)).execute("rush", asLog(makeLog()));
		new GetListeningUseCase(asMusic(repo)).execute("l1", asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
		expect(repo.searchListenings).toHaveBeenCalledWith("rush");
		expect(repo.findById).toHaveBeenCalledWith("l1");
	});

	it("save updates when an id is present", () => {
		const repo = fakeMusicRepo();
		new SaveListeningUseCase(asMusic(repo)).execute(
			{
				id: "l1",
				album: "X",
				contextTags: [],
			} as any,
			asLog(makeLog()),
		);
		expect(repo.update).toHaveBeenCalledWith("l1", { album: "X" });
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("save inserts a new listening with id and created when there is no id", () => {
		const repo = fakeMusicRepo();
		new SaveListeningUseCase(asMusic(repo)).execute({ album: "X" } as any, asLog(makeLog()));
		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ album: "X" });
		expect(inserted.id).toEqual(expect.any(String));
		expect(inserted.created).toEqual(expect.any(String));
	});

	it("delete forwards the id", () => {
		const repo = fakeMusicRepo();
		new DeleteListeningUseCase(asMusic(repo)).execute("l1", asLog(makeLog()));
		expect(repo.delete).toHaveBeenCalledWith("l1");
	});
});

describe("GetReportUseCase", () => {
	const from = "2020-01-01";
	const to = "2020-01-05"; // entirely in the past -> periodDaysCount is deterministic (5)

	it("returns an empty report when there are no listenings", async () => {
		const music = fakeMusicRepo();
		const genre = fakeGenreRepo();
		const report = await new GetReportUseCase(asMusic(music), asGenre(genre)).execute(
			{ from, to },
			asLog(makeLog()),
		);

		expect(report).toEqual({
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
		const music = fakeMusicRepo();
		music.findAll.mockResolvedValue([
			{ listeningDate: "2020-01-02", duration: 30, genre: "prog rock", artist: ["Rush"], compilation: false },
			{ listeningDate: "2020-01-03", duration: 20, genre: "metal", artist: ["Rush", "Tool"], compilation: false },
		]);
		const genre = fakeGenreRepo();
		genre.findAll.mockResolvedValue([{ name: "Rock", genres: ["prog rock", "metal"] }]);

		const report = await new GetReportUseCase(asMusic(music), asGenre(genre)).execute(
			{ from, to },
			asLog(makeLog()),
		);

		expect(report).toEqual({
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
