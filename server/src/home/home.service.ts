import type { GameWithOverview } from "@personal-tracker/shared/game";
import type { Program } from "@personal-tracker/shared/internet";
import type { BookOverview } from "@personal-tracker/shared/reading-book";
import type { MangaOverview } from "@personal-tracker/shared/reading-manga";

import { Injectable, Logger } from "@nestjs/common";

import { GameImagesStorage } from "../game/game-images.storage.js";
import { GameRepository } from "../game/game.repository.js";
import { InternetImagesStorage } from "../internet/internet-images.storage.js";
import { InternetRepository } from "../internet/internet.repository.js";
import { MusicRepository } from "../music/music.repository.js";
import { BookRepository } from "../reading-book/book.repository.js";
import { ReadingMangaRepository } from "../reading-manga/reading-manga.repository.js";
import { toPerformanceView } from "../show/performances/performance.entity.js";
import { PerformancesRepository } from "../show/performances/performances.repository.js";

const LATEST_GAMES = 3;
const LATEST_SHOWS = 6;
const LATEST_LISTENINGS = 10;
const LATEST_EPISODES = 6;
const LATEST_MANGAS = 6;
const LATEST_BOOKS = 6;

// The latest of each domain, for the home page
@Injectable()
export class HomeService {
	private readonly logger = new Logger(HomeService.name);

	constructor(
		private readonly gameRepo: GameRepository,
		private readonly gameImages: GameImagesStorage,
		private readonly performanceRepo: PerformancesRepository,
		private readonly musicRepo: MusicRepository,
		private readonly internetRepo: InternetRepository,
		private readonly internetImages: InternetImagesStorage,
		private readonly mangaRepo: ReadingMangaRepository,
		private readonly bookRepo: BookRepository,
	) {}

	async latest() {
		this.logger.log("latest");
		const today = Temporal.Now.plainDateISO().toString();
		const [games, performances, listenings, programs, mangas, books] = await Promise.all([
			this.gameRepo.findAll({
				search: "",
				sortField: "latestRealPlayDate",
				sortDirection: "desc",
				limit: LATEST_GAMES,
				withPlays: true,
			}),
			this.performanceRepo.findAllWithDetails({
				to: today,
				sortDirection: "desc",
				excludeCanceled: true,
				limit: LATEST_SHOWS,
			}),
			this.musicRepo.findAll({ limit: LATEST_LISTENINGS }),
			this.internetRepo.findLatestEpisodes(LATEST_EPISODES),
			this.mangaRepo.findAll({
				withReadings: true,
				sortField: "lastReadingDate",
				sortDirection: "desc",
				limit: LATEST_MANGAS,
			}),
			this.bookRepo.findAll({
				withReadingsDetails: false,
				sortField: "lastReadDate",
				sortDirection: "desc",
				limit: LATEST_BOOKS,
			}),
		]);

		return {
			// the ones never played / read sort last: only there when fewer than the limit were
			game: (games ?? [])
				.filter((game) => game.latestRealPlayDate)
				.map((game) => this.gameImages.resolveImages(game as GameWithOverview)),
			show: performances.map(toPerformanceView),
			music: (listenings ?? []).map((listening) => ({
				id: listening.id,
				artist: listening.artist,
				album: listening.album,
				date: listening.listeningDate,
			})),
			internet: (programs ?? []).map((program) => this.internetImages.resolveImages(program as Program)),
			"reading-manga": (mangas ?? []).filter((manga) => manga.lastReadingDate) as MangaOverview[],
			"reading-book": (books ?? []).filter((book) => book.lastReadDate) as BookOverview[],
		};
	}
}
