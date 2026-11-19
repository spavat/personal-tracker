import { describe, expect, it, vi } from "vitest";

import type { GameRepository } from "../game/game.repository.js";
import type { InternetRepository } from "../internet/internet.repository.js";
import type { MusicRepository } from "../music/music.repository.js";
import type { BookRepository } from "../reading-book/book.repository.js";
import type { ReadingMangaRepository } from "../reading-manga/reading-manga.repository.js";
import type { PerformancesRepository } from "../show/performances/performances.repository.js";

import { CalendarService } from "./calendar.service.js";

function fakes() {
	const music = { findAll: vi.fn().mockResolvedValue([]) };
	const internet = { findEpisodesInRange: vi.fn().mockResolvedValue([]) };
	const book = { findAll: vi.fn().mockResolvedValue([]) };
	const manga = { findAll: vi.fn().mockResolvedValue([]) };
	const performance = { findAll: vi.fn().mockResolvedValue([]) };
	const game = { findPlaysInRange: vi.fn().mockResolvedValue([]) };
	return { music, internet, book, manga, performance, game };
}

function build(f: ReturnType<typeof fakes>) {
	return new CalendarService(
		f.music as unknown as MusicRepository,
		f.internet as unknown as InternetRepository,
		f.book as unknown as BookRepository,
		f.manga as unknown as ReadingMangaRepository,
		f.performance as unknown as PerformancesRepository,
		f.game as unknown as GameRepository,
	);
}

describe("CalendarService.period", () => {
	it("returns an empty list when every source is empty", async () => {
		const f = fakes();
		expect(await build(f).period({ from: "2024-05-01", to: "2024-05-31" })).toEqual([]);
		expect(f.music.findAll).toHaveBeenCalledWith({ from: "2024-05-01", to: "2024-05-31" });
		expect(f.performance.findAll).toHaveBeenCalledWith({ from: "2024-05-01", to: "2024-05-31" });
	});

	it("folds music duration and game plays into one per-date entry", async () => {
		const f = fakes();
		f.music.findAll.mockResolvedValue([{ listeningDate: "2024-05-01", duration: 30 }]);
		f.game.findPlaysInRange.mockResolvedValue([{ id: "g1", plays: [{ date: "2024-05-01", duration: 60 }] }]);

		expect(await build(f).period({ from: "2024-05-01", to: "2024-05-31" })).toEqual([
			{ date: "2024-05-01", music: { duration: 30 }, game: { games: 1, duration: 60 } },
		]);
	});
});

describe("CalendarService.daily", () => {
	it("returns an empty object when every source is empty", async () => {
		const f = fakes();
		const service = new CalendarService(
			f.music as unknown as MusicRepository,
			f.internet as unknown as InternetRepository,
			f.book as unknown as BookRepository,
			f.manga as unknown as ReadingMangaRepository,
			f.performance as unknown as PerformancesRepository,
			f.game as unknown as GameRepository,
		);
		expect(await service.daily("2024-05-01")).toEqual({});
	});
});
