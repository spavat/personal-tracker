import { describe, expect, it, vi } from "vitest";

import type { GameRepository } from "../game/game.repository";
import type { InternetRepository } from "../internet/internet.repository";
import type { MusicRepository } from "../music/music.repository";
import type { BookRepository } from "../reading-book/book.repository";
import type { MangaRepository } from "../reading-manga/manga.repository";
import type { PerformanceRepository } from "../show/performances/performance.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { GetDailyCalendarUseCase, GetPeriodCalendarUseCase } from "./calendar.useCases";

function fakes() {
	const music = { findAll: vi.fn().mockResolvedValue([]) };
	const internet = { findEpisodesInRange: vi.fn().mockResolvedValue([]) };
	const book = { findAll: vi.fn().mockResolvedValue([]) };
	const manga = { findAll: vi.fn().mockResolvedValue([]) };
	const performance = { findAll: vi.fn().mockResolvedValue([]) };
	const game = { findPlaysInRange: vi.fn().mockResolvedValue([]) };
	return { music, internet, book, manga, performance, game };
}

function periodUseCase(f: ReturnType<typeof fakes>) {
	return new GetPeriodCalendarUseCase(
		f.music as unknown as MusicRepository,
		f.internet as unknown as InternetRepository,
		f.book as unknown as BookRepository,
		f.manga as unknown as MangaRepository,
		f.performance as unknown as PerformanceRepository,
		f.game as unknown as GameRepository,
	);
}

describe("GetPeriodCalendarUseCase", () => {
	it("returns an empty list when every source is empty", async () => {
		const f = fakes();
		expect(await periodUseCase(f).execute({ from: "2024-05-01", to: "2024-05-31" }, asLog(makeLog()))).toEqual([]);
		expect(f.music.findAll).toHaveBeenCalledWith({ from: "2024-05-01", to: "2024-05-31" });
		expect(f.performance.findAll).toHaveBeenCalledWith({ from: "2024-05-01", to: "2024-05-31" });
	});

	it("folds music duration and game plays into one per-date entry", async () => {
		const f = fakes();
		f.music.findAll.mockResolvedValue([{ listeningDate: "2024-05-01", duration: 30 }]);
		f.game.findPlaysInRange.mockResolvedValue([{ id: "g1", plays: [{ date: "2024-05-01", duration: 60 }] }]);

		expect(await periodUseCase(f).execute({ from: "2024-05-01", to: "2024-05-31" }, asLog(makeLog()))).toEqual([
			{ date: "2024-05-01", music: { duration: 30 }, game: { games: 1, duration: 60 } },
		]);
	});
});

describe("GetDailyCalendarUseCase", () => {
	it("returns an empty object when every source is empty", async () => {
		const f = fakes();
		const useCase = new GetDailyCalendarUseCase(
			f.music as unknown as MusicRepository,
			f.internet as unknown as InternetRepository,
			f.book as unknown as BookRepository,
			f.manga as unknown as MangaRepository,
			f.performance as unknown as PerformanceRepository,
			f.game as unknown as GameRepository,
		);
		expect(await useCase.execute("2024-05-01", asLog(makeLog()))).toEqual({});
	});
});
