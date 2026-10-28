import type { FastifyBaseLogger } from "fastify";

import { GameRepository } from "../game/game.repository";
import { InternetRepository } from "../internet/internet.repository";
import { MusicRepository } from "../music/music.repository";
import { buildTitleMap } from "../reading-book/book.entity";
import { BookRepository } from "../reading-book/book.repository";
import { MangaRepository } from "../reading-manga/manga.repository";
import { PerformanceRepository } from "../show/performances/performance.repository";

function getMonthBounds(yyyyMm: string) {
	// Parse "YYYY-MM" into a PlainYearMonth
	const yearMonth = Temporal.PlainYearMonth.from(yyyyMm);

	// First day of month
	const startOfMonth = yearMonth.toPlainDate({ day: 1 });

	// Last day of month
	const endOfMonth = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });

	return { startOfMonth, endOfMonth };
}

abstract class CalendarUseCaseBase {
	constructor(
		protected musicRepo: MusicRepository,
		protected internetRepo: InternetRepository,
		protected bookRepo: BookRepository,
		protected mangaRepo: MangaRepository,
		protected performanceRepo: PerformanceRepository,
		protected gameRepo: GameRepository,
	) {}

	protected async buildCalendar({ from, to }: { from: string; to: string }) {
		const programs = await this.internetRepo.findEpisodesInRange({ from, to });
		const listenings = await this.musicRepo.findAll({ from, to });
		const books = await this.bookRepo.findAll({
			from,
			to,
			withReadingsDetails: true,
		});
		const mangas = await this.mangaRepo.findAll({
			from,
			to,
			withReadings: true,
		});
		const performances = await this.performanceRepo.findAll({ from, to });
		const games = await this.gameRepo.findPlaysInRange({ from, to });

		const byDate: Record<string, any> = {};

		// Initialize the byDate object with all dates
		// let current = startOfMonth;
		// while (Temporal.PlainDate.compare(current, endOfMonth) <= 0) {
		// 	byDate[current.toString()] = {
		// 		music: 0,
		// 		internet: {
		// 			duration: 0,
		// 			episodes: 0,
		// 			programs: new Set(),
		// 		},
		// 		"reading-book": {
		// 			chapters: 0,
		// 			books: new Set(),
		// 		},
		// 		"reading-manga": {
		// 			chapters: 0,
		// 			volumes: 0,
		// 			mangas: new Set(),
		// 		},
		// 		show: [],
		// 	};
		// 	current = current.add({ days: 1 });
		// }

		// Music
		for (let listening of listenings ?? []) {
			if (!byDate[listening.listeningDate]) {
				byDate[listening.listeningDate] = {
					music: 0,
				};
			}
			byDate[listening.listeningDate].music += listening.duration;
		}

		// Internet
		for (let program of programs ?? []) {
			for (let episode of program.episodes ?? []) {
				const date = episode.date;
				if (!byDate[date]) {
					byDate[date] = {};
				}
				if (!byDate[date].internet) {
					byDate[date].internet = {
						duration: 0,
						episodes: 0,
						programs: new Set(),
					};
				}
				byDate[date].internet.duration += episode.durationReal ?? episode.duration;
				byDate[date].internet.episodes += 1;
				byDate[date].internet.programs.add(program.id);
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
				...(data.internet && {
					internet: {
						duration: data.internet?.duration ?? 0,
						episodes: data.internet?.episodes ?? 0,
						programs: data.internet?.programs.size ?? 0,
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
}

export class GetPeriodCalendarUseCase extends CalendarUseCaseBase {
	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger) {
		log.info("GetPeriodCalendarUseCase.execute");
		return this.buildCalendar({ from, to });
	}
}

export class GetMonthlyCalendarUseCase extends CalendarUseCaseBase {
	async execute(period: string, log: FastifyBaseLogger) {
		log.info("GetMonthlyCalendarUseCase.execute");
		const { startOfMonth, endOfMonth } = getMonthBounds(period);
		return this.buildCalendar({ from: startOfMonth.toString(), to: endOfMonth.toString() });
	}
}

export class GetDailyCalendarUseCase {
	constructor(
		private musicRepo: MusicRepository,
		private internetRepo: InternetRepository,
		private bookRepo: BookRepository,
		private mangaRepo: MangaRepository,
		private performanceRepo: PerformanceRepository,
		private gameRepo: GameRepository,
	) {}

	async execute(date: string, log: FastifyBaseLogger) {
		log.info("GetDailyCalendarUseCase.execute");
		const programs = await this.internetRepo.findEpisodesInRange({ from: date, to: date });
		const listenings = await this.musicRepo.findAll({ from: date, to: date });
		const books = await this.bookRepo.findAll({
			from: date,
			to: date,
			withReadingsDetails: true,
		});
		const mangas = await this.mangaRepo.findAll({
			from: date,
			to: date,
			withReadings: true,
		});
		const performances = await this.performanceRepo.findAll({ from: date, to: date });
		const games = await this.gameRepo.findPlaysInRange({ from: date, to: date });

		const musicItems =
			listenings?.map((listening) => ({
				id: listening.id,
				artist: listening.artist,
				album: listening.album,
				duration: listening.duration,
				...((listening.contextTags?.length ?? 0) > 0 && { contextTags: listening.contextTags }),
				created: listening.created,
			})) ?? [];
		const internetItems =
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
				const titleMap = buildTitleMap(book.model);
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
			...(internetItems.length > 0 && { internet: internetItems }),
			...(bookItems.length > 0 && { "reading-book": bookItems }),
			...(mangaItems.length > 0 && { "reading-manga": mangaItems }),
			...(gameItems.length > 0 && { game: gameItems }),
			...(showItems.length > 0 && { show: showItems }),
		};
	}
}
