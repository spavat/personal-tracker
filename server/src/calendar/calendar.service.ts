import { Injectable, Logger } from "@nestjs/common";

import { BroadcastRepository } from "../broadcast/broadcast.repository.js";
import { GameRepository } from "../game/game.repository.js";
import { MusicRepository } from "../music/music.repository.js";
import { buildTitleMap } from "../reading-book/book.entity.js";
import { BookRepository } from "../reading-book/book.repository.js";
import { ReadingMangaRepository } from "../reading-manga/reading-manga.repository.js";
import { PerformancesRepository } from "../show/performances/performances.repository.js";

function getMonthBounds(yyyyMm: string) {
	// Parse "YYYY-MM" into a PlainYearMonth
	const yearMonth = Temporal.PlainYearMonth.from(yyyyMm);

	// First day of month
	const startOfMonth = yearMonth.toPlainDate({ day: 1 });

	// Last day of month
	const endOfMonth = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });

	return { startOfMonth, endOfMonth };
}

@Injectable()
export class CalendarService {
	private readonly logger = new Logger(CalendarService.name);

	constructor(
		private readonly musicRepo: MusicRepository,
		private readonly broadcastRepo: BroadcastRepository,
		private readonly bookRepo: BookRepository,
		private readonly mangaRepo: ReadingMangaRepository,
		private readonly performanceRepo: PerformancesRepository,
		private readonly gameRepo: GameRepository,
	) {}

	private async buildCalendar({ from, to }: { from: string; to: string }) {
		const [programs, listenings, books, mangas, performances, games] = await Promise.all([
			this.broadcastRepo.findEpisodesInRange({ from, to }),
			this.musicRepo.findAll({ from, to }),
			this.bookRepo.findAll({
				from,
				to,
				withReadingsDetails: true,
			}),
			this.mangaRepo.findAll({
				from,
				to,
				withReadings: true,
			}),
			this.performanceRepo.findAll({ from, to }),
			this.gameRepo.findPlaysInRange({ from, to }),
		]);

		const byDate: Record<string, any> = {};

		// Music
		for (let listening of listenings ?? []) {
			if (!byDate[listening.listeningDate]) {
				byDate[listening.listeningDate] = {
					music: 0,
				};
			}
			byDate[listening.listeningDate].music += listening.duration;
		}

		// Broadcast
		for (let program of programs ?? []) {
			for (let episode of program.episodes ?? []) {
				const date = episode.date;
				if (!byDate[date]) {
					byDate[date] = {};
				}
				if (!byDate[date].broadcast) {
					byDate[date].broadcast = {
						duration: 0,
						episodes: 0,
						programs: new Set(),
					};
				}
				byDate[date].broadcast.duration += episode.durationReal ?? episode.duration;
				byDate[date].broadcast.episodes += 1;
				byDate[date].broadcast.programs.add(program.id);
			}
		}

		// Reading Book
		for (let book of books ?? []) {
			for (let reading of book.readings ?? []) {
				for (let details of reading.details ?? []) {
					for (let context of details.context ?? []) {
						if (!byDate[context.date]) {
							byDate[context.date] = {};
						}
						if (!byDate[context.date]["reading-book"]) {
							byDate[context.date]["reading-book"] = {
								chapters: 0,
								books: new Set(),
							};
						}
						byDate[context.date]["reading-book"].books.add(book.id);
						byDate[context.date]["reading-book"].chapters += 1;
					}
				}
			}
		}

		// Manga
		for (let manga of mangas ?? []) {
			for (let reading of manga.readings ?? []) {
				if (!byDate[reading.date]) {
					byDate[reading.date] = {};
				}
				if (!byDate[reading.date]["reading-manga"]) {
					byDate[reading.date]["reading-manga"] = {
						chapters: 0,
						volumes: 0,
						mangas: new Set(),
					};
				}
				byDate[reading.date]["reading-manga"].mangas.add(manga.id);
				if (reading.type === "volume") {
					byDate[reading.date]["reading-manga"].volumes += 1;
				} else if (reading.type === "chapter") {
					byDate[reading.date]["reading-manga"].chapters += 1;
				}
			}
		}

		// Game
		for (let game of games ?? []) {
			for (let play of game.plays ?? []) {
				if (!byDate[play.date]) {
					byDate[play.date] = {};
				}
				if (!byDate[play.date].game) {
					byDate[play.date].game = { games: new Set(), duration: 0 };
				}
				byDate[play.date].game.games.add(game.id);
				byDate[play.date].game.duration += play.duration ?? 0;
			}
		}

		// Spectacles
		for (let performance of performances ?? []) {
			const date = performance.date.substring(0, 10); // Extract the date part (YYYY-MM-DD) from the datetime string
			if (!byDate[date]) {
				byDate[date] = {};
			}
			if (!byDate[date].show) {
				byDate[date].show = [];
			}

			byDate[date].show.push({ name: performance.spectacle });
		}
		const result = Object.entries(byDate).map(([date, data]) => {
			return {
				date,
				...(data.music && { music: { duration: data.music ?? 0 } }),
				...(data.broadcast && {
					broadcast: {
						duration: data.broadcast?.duration ?? 0,
						episodes: data.broadcast?.episodes ?? 0,
						programs: data.broadcast?.programs.size ?? 0,
					},
				}),
				...(data["reading-book"] && {
					"reading-book": {
						books: data["reading-book"]?.books.size ?? 0,
						chapters: data["reading-book"]?.chapters ?? 0,
					},
				}),
				...(data["reading-manga"] && {
					"reading-manga": {
						mangas: data["reading-manga"]?.mangas.size ?? 0,
						chapters: data["reading-manga"]?.chapters ?? 0,
						volumes: data["reading-manga"]?.volumes ?? 0,
					},
				}),
				...(data.game && {
					game: {
						games: data.game?.games.size ?? 0,
						duration: data.game?.duration ?? 0,
					},
				}),
				...(data.show && { show: data.show }),
			};
		});
		return result;
	}

	async period({ from, to }: { from: string; to: string }) {
		this.logger.log("period");
		return this.buildCalendar({ from, to });
	}

	async monthly(period: string) {
		this.logger.log("monthly");
		const { startOfMonth, endOfMonth } = getMonthBounds(period);
		return this.buildCalendar({ from: startOfMonth.toString(), to: endOfMonth.toString() });
	}

	async daily(date: string) {
		this.logger.log("daily");
		const [programs, listenings, books, mangas, performances, games] = await Promise.all([
			this.broadcastRepo.findEpisodesInRange({ from: date, to: date }),
			this.musicRepo.findAll({ from: date, to: date }),
			this.bookRepo.findAll({
				from: date,
				to: date,
				withReadingsDetails: true,
			}),
			this.mangaRepo.findAll({
				from: date,
				to: date,
				withReadings: true,
			}),
			this.performanceRepo.findAll({ from: date, to: date }),
			this.gameRepo.findPlaysInRange({ from: date, to: date }),
		]);

		const musicItems =
			listenings?.map((listening) => ({
				id: listening.id,
				artist: listening.artist,
				album: listening.album,
				duration: listening.duration,
				...((listening.contextTags?.length ?? 0) > 0 && { contextTags: listening.contextTags }),
				created: listening.created,
			})) ?? [];
		const broadcastItems =
			programs?.flatMap((program) => {
				return program.episodes?.map((episode: any) => {
					return {
						programId: program.id,
						programName: program.name,
						episodeId: episode.id,
						episodeName: episode.name,
						duration: episode.duration,
						...(episode.durationReal && { durationReal: episode.durationReal }),
						...((episode.contextTags?.length ?? 0) > 0 && { contextTags: episode.contextTags }),
						created: episode.created,
						comment: episode.comment,
					};
				});
			}) ?? [];
		const bookItems =
			books?.map((book) => {
				// chapter ids are uuids: the titles of all the book's models can share one map
				const titleMap = buildTitleMap(book.models.flatMap(({ tree }) => tree));
				return {
					id: book.id,
					name: book.book,
					readings: book.readings?.flatMap((reading: any) => {
						return reading.details?.map((detail: any) => {
							return {
								id: detail.id,
								name: titleMap[detail.id] ?? "",
								...((detail.context?.length ?? 0) > 0 && {
									contextTags: detail.context.flatMap((c: any) => c.tags),
								}),
							};
						});
					}),
				};
			}) ?? [];
		const mangaItems =
			mangas?.map((manga) => ({
				id: manga.id,
				name: manga.title,
				readings: manga.readings?.map((reading: any) => {
					return {
						id: reading.id,
						name: reading.name,
						type: reading.type,
						created: reading.created,
					};
				}),
			})) ?? [];
		const gameItems =
			games?.flatMap((game) => ({
				id: game.id,
				name: game.name,
				developper: game.developper,
				plays: game.plays?.map((play: any) => {
					return {
						id: play.id,
						duration: play.duration,
					};
				}),
			})) ?? [];

		const showItems =
			performances?.map((performance) => ({
				id: performance.id,
				name: performance.spectacle ?? "",
				time: Temporal.PlainTime.from(performance.date).toString({ smallestUnit: "minutes" }),
				place: performance.place ?? "",
			})) ?? [];
		return {
			...(musicItems.length > 0 && { music: musicItems }),
			...(broadcastItems.length > 0 && { broadcast: broadcastItems }),
			...(bookItems.length > 0 && { "reading-book": bookItems }),
			...(mangaItems.length > 0 && { "reading-manga": mangaItems }),
			...(gameItems.length > 0 && { game: gameItems }),
			...(showItems.length > 0 && { show: showItems }),
		};
	}
}
