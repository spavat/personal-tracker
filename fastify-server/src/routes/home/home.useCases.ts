import type { GameWithOverview } from "@personal-tracker/shared/game";
import type { Program } from "@personal-tracker/shared/internet";
import type { BookOverview } from "@personal-tracker/shared/reading-book";
import type { MangaOverview } from "@personal-tracker/shared/reading-manga";
import type { FastifyBaseLogger } from "fastify";

import type { GameImageStorageRepository } from "../game/image-storage.repository";
import type { ImageStorageRepository as InternetImageStorageRepository } from "../internet/image-storage.repository";

import { GameRepository } from "../game/game.repository";
import { InternetRepository } from "../internet/internet.repository";
import { MusicRepository } from "../music/music.repository";
import { BookRepository } from "../reading-book/book.repository";
import { MangaRepository } from "../reading-manga/manga.repository";
import { toPerformanceView } from "../show/performances/performance.entity";
import { PerformanceRepository } from "../show/performances/performance.repository";

const LATEST_GAMES = 3;
const LATEST_SHOWS = 6;
const LATEST_LISTENINGS = 10;
const LATEST_EPISODES = 6;
const LATEST_MANGAS = 6;
const LATEST_BOOKS = 6;

export class GetLatestUseCase {
	constructor(
		private gameRepo: GameRepository,
		private gameImages: Pick<GameImageStorageRepository, "resolveImages">,
		private performanceRepo: PerformanceRepository,
		private musicRepo: MusicRepository,
		private internetRepo: InternetRepository,
		private internetImages: Pick<InternetImageStorageRepository, "resolveImages">,
		private mangaRepo: MangaRepository,
		private bookRepo: BookRepository,
	) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetLatestUseCase.execute");
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
